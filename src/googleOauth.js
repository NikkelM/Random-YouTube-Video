// Contains logic to login and authenticate users through Google Oauth and Firebase Auth
import { setSyncStorageValue } from "./chromeStorage.js";
import { isFirefox, firebaseConfig } from "./config.js";
import { getSubscriptions } from "./stripe.js";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "firebase/auth";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Get user information from storage or by logging in to Google
// If localOnly is set to true, the function will not attempt to log in to Google if there is no local information (==in sync storage)
export async function getUser(localOnly, allowSelfRevoke, signupIfNull) {
	// TODO: If there is a user and an active subscription, fetch a new access token in the background script on startup, and validate the subscription status
	console.log("Getting user info.");
	const googleOauth = await getLocalGoogleOauth();

	if (localOnly) {
		if (googleOauth?.userInfo) {
			return googleOauth.userInfo;
		}
		console.log("No local user info found.");
		return null;
	} else if (googleOauth == null && signupIfNull) {
		console.log("Attempting to sign up using Google Oauth.");
		// This will also refresh the access token if it has expired
		return await googleLogin(allowSelfRevoke);
	} else {
		console.log("No local user info found, and not attempting to sign up.");
		return null;
	}
}

// Run the Google Oauth flow until the user is logged in to Google and Firebase.
// If the user manually revoked access to the app, the attempt to get a token will return a 400 TOKEN_EXPIRED error and automatically launch the normal flow.
// TODO: Make sure we can have access to the YouTube account auto-ticked in the Google Oauth flow, or get notified if the user didn't do so so we can notify them afterwards and reprompt
async function googleLogin(allowSelfRevoke = true) {
	// Get sync storage information about the user's Google Oauth state
	let googleOauth = await getLocalGoogleOauth() || {};

	onAuthStateChanged(auth, async (user) => {
		if (user) {
			console.log("Signed in to Firebase successfully!");
			// Extract the user info we need and save it to sync storage
			googleOauth.userInfo = {
				displayName: user.displayName,
				email: user.email,
				firebaseUid: user.uid
			};

			await setSyncStorageValue("googleOauth", googleOauth);
		}
	});

	// If we still have a valid access token, use it to authenticate to Firebase
	if (googleOauth.accessToken && googleOauth.expiresOn > new Date().getTime() + 300000) {
		console.log("Using cached access token");
		// Login the user to Firebase
		const credential = GoogleAuthProvider.credential(googleOauth.idToken, googleOauth.accessToken);
		await signInWithCredential(auth, credential);

		if (!googleOauth.refreshToken) {
			try {
				await fetchRefreshTokenFromFirestore(googleOauth, allowSelfRevoke);
			} catch (error) {
				console.error(error);
				return {
					error: error,
					code: "GO-4"
				};
			}
		}
		// If there is no current access token, we will need to either use the refresh token or get a code to exchange for an access token
	} else {
		// Generate a random string to use as a CSRF token
		let generatedState = "";
		while (generatedState.length < 32) {
			(generatedState += Math.random().toString(36).slice(2)).substring(2, 34);
		}

		// TODO: Refactor to separate function
		let redirectUri;
		if (isFirefox) {
			// We cannot verify ownership of the normal redirect URL, but local loopbacks are always allowed
			const baseRedirectUrl = browser.identity.getRedirectURL();
			const redirectSubdomain = baseRedirectUrl.slice(0, baseRedirectUrl.indexOf(".")).replace("https://", "");
			redirectUri = `http://127.0.0.1/mozoauth2/${redirectSubdomain}`;
		} else {
			// For chromium based browsers, we can use the normal redirect URL, as it is verified through the extension's public key
			redirectUri = chrome.identity.getRedirectURL();
		}

		if (googleOauth.refreshToken) {
			console.log("Exchanging refresh token for access token");
			googleOauth = await runGoogleOauthAuthentication("refreshTokenExchange", googleOauth.refreshToken, generatedState, redirectUri, googleOauth, auth, allowSelfRevoke);
		} else {
			console.log("Using code exchange, as there is no access or refresh token available.");
			// Before we can run the Google Oauth authentication flow, we need to get an authentication code from Google
			try {
				googleOauth = await runWebAuthFlow(generatedState, redirectUri, googleOauth, auth, allowSelfRevoke);
			} catch (error) {
				console.error(error);
				let code = "GO-0"; // Unknown error
				if (error.message.includes("CSRF token mismatch")) {
					code = "GO-2";
				} else if (error.message.includes("User closed the authorization window")) {
					code = "GO-3";
				}
				return {
					error: error,
					code: code
				};
			}
			console.log("Completed the web auth flow.");
		}
	}

	return googleOauth.userInfo ? googleOauth.userInfo : googleOauth;
}

async function runWebAuthFlow(generatedState, redirectUri, googleOauth, auth, allowSelfRevoke) {
	console.log("Running the web auth flow");
	return new Promise((resolve, reject) => {
		// Launch a popup that prompts the user to login to their Google account and grant the app permissions as requested
		chrome.identity.launchWebAuthFlow({
			"url": `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=${generatedState}&client_id=141257152664-9ps6uugd281t3b581q5phdl1qd245tcf.apps.googleusercontent.com&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/youtube.readonly`,
			"interactive": true
		}, async function (redirectURL) {
			try {
				if (redirectURL == undefined || redirectURL == null || redirectURL == "") {
					reject(new Error("User closed the authorization window."));
					return;
				}
				const returnedState = redirectURL.split("state=")[1].split("&")[0];

				if (generatedState != returnedState) {
					reject(new Error("CSRF token mismatch communicating with Google. Please try again or report this issue."));
					return;
				}

				console.log("Exchanging authentication code for access token");
				const returnedToken = redirectURL.split("code=")[1].split("&")[0];
				googleOauth = await runGoogleOauthAuthentication("codeExchange", returnedToken, generatedState, redirectUri, googleOauth, auth, allowSelfRevoke);
				resolve(googleOauth);
			} catch (error) {
				reject(error);
			}
		});
	}).catch(error => {
		throw error;
	});
}

// Gets the Google Oauth refresh token for the current user from Firestore and saves it locally
async function fetchRefreshTokenFromFirestore(googleOauth, allowSelfRevoke) {
	console.log("Getting the Google Oauth refresh token from Firestore, as it does not exist locally.");
	let haveRefreshToken = true;

	const authMetadataRef = doc(db, "users", getAuth().currentUser.uid, "authMetadata", "google");
	const authMetadataDoc = await getDoc(authMetadataRef);
	if (authMetadataDoc.exists()) {
		const data = authMetadataDoc.data();
		if (data.googleRefreshToken) {
			googleOauth.refreshToken = data.googleRefreshToken;
			await setSyncStorageValue("googleOauth", googleOauth);
		} else {
			haveRefreshToken = false;
		}
	} else {
		haveRefreshToken = false;
	}

	if (!haveRefreshToken && allowSelfRevoke) {
		console.error("No refresh token available in Firestore. Self-revoking app access.");
		await revokeAccess();
		throw new Error("Getting required authentication data failed. Please grant the app access again.");
	} else if (!haveRefreshToken) {
		console.error("No refresh token available in Firestore, but self-revoking access is not allowed.");
		throw new Error("Getting required authentication data failed. Please go to your Google account dashboard and revoke access to the extension, then try again.");
	}
}

// Exchanges a code or refresh token for an access token using the backend Google Cloud Function
async function runGoogleOauthAuthentication(action, passedToken, generatedState, redirectUri, googleOauth, auth, allowSelfRevoke) {
	let accessToken, refreshToken, idToken, expiresOn, returnedState;
	// Get an access, refresh and id token (unused) for the user
	try {
		await fetch(`https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange?action=${action}&token=${passedToken}&state=${generatedState}&redirectUri=${redirectUri}`)
			.then(response => response.json())
			.then(data => {
				accessToken = data.access_token;
				refreshToken = data.refresh_token;
				expiresOn = new Date().getTime() + (data.expires_in * 1000);
				returnedState = data.state;
				if (returnedState != generatedState) {
					throw new Error("CSRF token mismatch during token exchange. Please try again or report this issue.");
				}
			});
	} catch (error) {
		console.error(error);
		return {
			error: error,
			code: "GO-1"
		};
	}

	googleOauth.accessToken = accessToken;
	googleOauth.expiresOn = expiresOn;
	googleOauth.idToken = idToken;
	if (refreshToken) {
		googleOauth.refreshToken = refreshToken;
	}
	await setSyncStorageValue("googleOauth", googleOauth);

	// Login the user to Firebase
	const credential = GoogleAuthProvider.credential(googleOauth.idToken, googleOauth.accessToken);
	await signInWithCredential(auth, credential);

	if (refreshToken) {
		// Save the refresh token to Firestore
		const authMetadataRef = doc(db, "users", getAuth().currentUser.uid, "authMetadata", "google");
		await setDoc(authMetadataRef, {
			googleRefreshToken: refreshToken
		}, { merge: true });
	} else if (!googleOauth.refreshToken) {
		try {
			await fetchRefreshTokenFromFirestore(googleOauth, allowSelfRevoke);
		} catch (error) {
			console.error(error);
			return {
				error: error,
				code: "GO-4"
			};
		}
	}

	return googleOauth;
}

async function getLocalGoogleOauth() {
	const googleOauth = (await chrome.storage.sync.get("googleOauth")).googleOauth;
	return googleOauth;
}

// Gets all scopes granted by the user
// TODO: Use this to check if the user has granted the youtube scope before we can enable features using it
export async function getGrantedOauthScopes() {
	// Refreshes the access token
	const user = await getUser(false, false, false);
	if (!user) {
		console.log("No user found");
		return [];
	}

	const accessToken = (await getLocalGoogleOauth()).accessToken;
	// Use  https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=
	const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
		.then(response => response.json())
		.then(data => {
			return data.scope ?? "";
		});
	let grantedScopes = tokenInfo.split(" ").map(scope => {
		const parts = scope.split("/");
		return parts[parts.length - 1];
	});
	return grantedScopes;
}

// Revokes access to the app for the current user, and deletes it if requested and there is no active subscription
export async function revokeAccess(user = null, deleteUser = false) {
	// Make sure there is an active token and the user is authenticated with Firebase
	user ??= await getUser(false, false, false);
	const googleOauth = await getLocalGoogleOauth();
	const usedToken = googleOauth.accessToken || googleOauth.refreshToken;

	if (usedToken) {
		let postOptions = {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: `token=${usedToken}`
		};

		// We need to do this before revoking the tokens as it needs a valid authorization
		const hasActiveSubscription = (await getSubscriptions(user, true)).length > 0;

		const revokeSuccessful = await fetch("https://oauth2.googleapis.com/revoke", postOptions)
			.then(response => {
				if (response.ok) {
					console.log("Token revoked successfully.");
					return setSyncStorageValue("googleOauth", null).then(async () => {
						// TODO: If there is no active subscription, remove all user data from Firebase
						// We always remove the refreshToken, as it is no longer active
						const authMetadataRef = doc(db, "users", getAuth(app).currentUser.uid, "authMetadata", "google");
						await deleteDoc(authMetadataRef);
						return true;
					});
				} else {
					console.error("Failed to revoke token:", response);
					return false;
				}
			})
			.catch(error => {
				console.error("Network error:", error);
				return false;
			});

		if (revokeSuccessful && deleteUser && !hasActiveSubscription) {
			const user = getAuth(app).currentUser;

			// Delete the user account. Stripe should clean up the Firestore document
			user.delete().then(() => {
				console.log("User deleted");
			}).catch((error) => {
				console.error("Error deleting user:", error);
			});
		}

		return revokeSuccessful;
	} else {
		console.log("No token to revoke.");
		await setSyncStorageValue("googleOauth", null);
		return true;
	}
}
