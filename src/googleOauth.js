// Contains logic to login and authenticate users through Google Oauth and Firebase Auth
import { setSyncStorageValue } from "./chromeStorage.js";
import { isFirefox, firebaseConfig } from "./config.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "firebase/auth";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get user information from storage or by logging in to Google
// If localOnly is set to true, the function will not attempt to log in to Google if there is no local information (==in sync storage)
export async function getUser(localOnly) {
	console.log(`Getting user info. localOnly: ${localOnly}`);
	if (localOnly) {
		const googleOauth = (await chrome.storage.sync.get("googleOauth")).googleOauth;
		if (googleOauth?.userInfo) {
			return googleOauth.userInfo;
		}
		console.log("No local user info found");
		return null;
	} else {
		console.log("Attempting to log in using Google Oauth");
		return await googleLogin();
	}
}

// Run the Google Oauth flow until the user is logged in to Google and Firebase.
// TODO: Handle the case where the user has revoked access to the app. Would probably be getting a 400/401 error when refreshing the token?
// TODO: Offer functionality to self-revoke access to the app/for the user to be forgotten
// See above: Also useful if we lose the refresh token
// See https://stackoverflow.com/questions/18030486/google-oauth2-application-remove-self-from-user-authenticated-applications
async function googleLogin() {
	// Get sync storage information about the user's Google Oauth state
	let googleOauth = (await chrome.storage.sync.get("googleOauth")).googleOauth || {};

	// Set up the Firebase authentication handler
	const auth = getAuth(app);
	onAuthStateChanged(auth, async (user) => {
		if (user) {
			console.log("Signed in successfully!");
			// Extract the user info we need and save it to sync storage
			googleOauth.userInfo = {
				displayName: user.displayName,
				email: user.email,
				firebaseUid: user.uid
			};

			await setSyncStorageValue("googleOauth", googleOauth);
		} else {
			console.log("Signed out successfully, or the sign in flow was started!");
		}
	});

	// If we still have a valid access token, use it to authenticate to Firebase
	if (googleOauth.accessToken && googleOauth.expiresOn > new Date().getTime() + 300000) {
		console.log("Using cached access token");
		// Login the user to Firebase
		const credential = GoogleAuthProvider.credential(googleOauth.idToken, googleOauth.accessToken);
		await signInWithCredential(auth, credential);

		// If the response from Google Oauth didn't include a refresh token, it means the user has previously granted the app access to their account
		// That means that we will have the refresh token saved in the database 
		if (!googleOauth.refreshToken) {
			await fetchRefreshTokenFromFirestore(googleOauth);
		}
		// If there is no current access token, we will need to either use the refresh token or get a code to exchange for an access token
	} else {
		// Generate a random string to use as a CSRF token
		let generatedState = "";
		while (generatedState.length < 32) {
			(generatedState += Math.random().toString(36).slice(2)).substring(2, 34);
		}

		let redirectUri;
		if (isFirefox) {
			// We cannot verify ownership of the normal redirect URL, but local loopbacks are always allowed
			const baseRedirectUrl = browser.identity.getRedirectURL();
			const redirectSubdomain = baseRedirectUrl.slice(0, baseRedirectUrl.indexOf('.')).replace('https://', '');
			redirectUri = `http://127.0.0.1/mozoauth2/${redirectSubdomain}`;
		} else {
			// For chromium based browsers, we can use the normal redirect URL, as it is verified through the extension's public key
			redirectUri = chrome.identity.getRedirectURL();
		}

		if (googleOauth.refreshToken) {
			console.log("Exchanging refresh token for access token");
			googleOauth = await runGoogleOauthAuthentication("refreshTokenExchange", googleOauth.refreshToken, generatedState, redirectUri, googleOauth, auth);
		} else {
			console.log("Using code exchange, as there is no access or refresh token available.");
			// Before we can run the Google Oauth authentication flow, we need to get an authentication code from Google
			try {
				googleOauth = await runWebAuthFlow(generatedState, redirectUri, googleOauth, auth);
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
			console.log("Completed the web auth flow.")
		}
	}

	return googleOauth.userInfo ? googleOauth.userInfo : googleOauth
}

async function runWebAuthFlow(generatedState, redirectUri, googleOauth, auth) {
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
				googleOauth = await runGoogleOauthAuthentication("codeExchange", returnedToken, generatedState, redirectUri, googleOauth, auth);
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
async function fetchRefreshTokenFromFirestore(googleOauth) {
	console.log("Getting the Google Oauth refresh token from Firestore, as it does not exist locally.");
	const userRef = doc(db, "users", getAuth().currentUser.uid);
	const userDoc = await getDoc(userRef);
	if (userDoc.exists()) {
		const data = userDoc.data();
		if (data.googleRefreshToken) {
			googleOauth.refreshToken = data.googleRefreshToken;
			await setSyncStorageValue("googleOauth", googleOauth);
		}
	}
}

// Exchanges a code or refresh token for an access token using the backend Google Cloud Function
async function runGoogleOauthAuthentication(action, passedToken, generatedState, redirectUri, googleOauth, auth) {
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
		const userRef = doc(db, "users", getAuth().currentUser.uid);
		await setDoc(userRef, {
			googleRefreshToken: refreshToken
		}, { merge: true });
	} else if (!googleOauth.refreshToken) {
		await fetchRefreshTokenFromFirestore(googleOauth);
	}

	return googleOauth;
}
