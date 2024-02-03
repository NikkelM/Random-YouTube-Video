
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "firebase/auth";

const isFirefox = typeof browser !== "undefined";
const firebaseConfig = {
  apiKey: "AIzaSyA6d7Ahi7fMB4Ey8xXM8f9C9Iya97IGs-c",
  authDomain: "random--video-ex-chrome.firebaseapp.com",
  projectId: "random-youtube-video-ex-chrome",
  storageBucket: "random-youtube-video-ex-chrome.appspot.com",
  messagingSenderId: "141257152664",
  appId: "1:141257152664:web:f70e46e35d02921a8818ed",
  databaseURL: "https://random-youtube-video-ex-chrome-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get products and pricing information from Firestore/Stripe
async function getProducts() {
  const q = query(
    collection(db, 'products'),
    where('active', '==', true)
  );

  const querySnapshot = await getDocs(q);

  // for each product, get the product price info
  const productsPromises = querySnapshot.docs.map(async (productDoc) => {
    let productInfo = productDoc.data();

    // fetch prices subcollection per product
    const pricesCollection = collection(productDoc.ref, 'prices');
    const priceQuerySnapshot = await getDocs(pricesCollection);

    // assume there is only one price per product
    const priceDoc = priceQuerySnapshot.docs[0];
    productInfo['priceId'] = priceDoc.id;
    productInfo['priceInfo'] = priceDoc.data();
    return productInfo;
  });

  // 'products' is an array of products (including price info)
  const products = await Promise.all(productsPromises);
  return products;
}

// Get user information from local storage or by logging in to Google
// If localOnly is set to true, the function will not attempt to log in to Google if there is no local information
export async function getUser(localOnly) {
  console.log(`Getting user info. Local only: ${localOnly}`);
  if (localOnly) {
    const googleOauth = (await chrome.storage.local.get("googleOauth")).googleOauth;
    if (googleOauth?.userInfo) {
      return googleOauth.userInfo;
    }
    console.log("No local user info found");
    return null;
  } else {
    console.log("Attempting to log in to Google");
    return await googleLogin();
  }
}

// Run the Google Oauth flow until the user is logged in to Google and Firebase
// TODO: Handle the case where the user has revoked access to the app. Would probably be getting a 400/401 error when refreshing the token?
async function googleLogin() {
  // Get local information about the user's Google Oauth state
  let googleOauth = (await chrome.storage.local.get("googleOauth")).googleOauth || {};

  // Set up the Firebase authentication handler
  const auth = getAuth(app);
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Signed in successfully!");
      // Extract the user info we need and save it locally
      googleOauth.userInfo = {
        displayName: user.displayName,
        email: user.email,
        firebaseUid: user.uid
      };

      await chrome.storage.local.set({ "googleOauth": googleOauth });
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
      // For chromium based browsers, we can use the normal redirect URL, as it is verified by the extension key
      redirectUri = chrome.identity.getRedirectURL();
    }

    if (googleOauth.refreshToken) {
      console.log("Exchanging refresh token for access token");
      googleOauth = await runGoogleOauthAuthentication("refreshTokenExchange", googleOauth.refreshToken, generatedState, redirectUri, googleOauth, auth);
    } else {
      console.log("Using code exchange, as there is no access or refresh token available.");
      // Before we can run the Google Oauth authentication flow, we need to get an authentication code from Google
      googleOauth = await runWebAuthFlow(generatedState, redirectUri, googleOauth, auth);
      console.log("Completed the web auth flow.")
    }
  }

  return googleOauth.userInfo;
}

async function runWebAuthFlow(generatedState, redirectUri, googleOauth, auth) {
  console.log("Running the web auth flow")
  // TODO: Use the chrome native login flow if it's available? Is there an upside to this?

  return new Promise((resolve, reject) => {
    // Launch a popup that prompts the user to login to their Google account and grant the app permissions as requested
    chrome.identity.launchWebAuthFlow({
      "url": `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=${generatedState}&client_id=141257152664-9ps6uugd281t3b581q5phdl1qd245tcf.apps.googleusercontent.com&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/youtube.readonly`,
      "interactive": true
    }, async function (redirect_url) {
      const returnedState = redirect_url.split("state=")[1].split("&")[0];

      if (generatedState != returnedState) {
        // TODO: Handle this error
        console.log("CSRF token does not match");
        reject(new Error("CSRF token does not match"));
      }

      console.log("Exchanging authentication code for access token");
      const returnedToken = redirect_url.split("code=")[1].split("&")[0];
      googleOauth = await runGoogleOauthAuthentication("codeExchange", returnedToken, generatedState, redirectUri, googleOauth, auth);
      resolve(googleOauth);
    });
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
      await chrome.storage.local.set({ "googleOauth": googleOauth });
    }
  }
}

// Exchanges a code or refresh token for an access token using the backend Google Cloud Function
async function runGoogleOauthAuthentication(action, passedToken, generatedState, redirectUri, googleOauth, auth) {
  let accessToken, refreshToken, idToken, expiresOn, returnedState;
  // Get an access, refresh and id token (unused) for the user
  await fetch(`https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange?action=${action}&token=${passedToken}&state=${generatedState}&redirectUri=${redirectUri}`)
    .then(response => response.json())
    .then(data => {
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      expiresOn = new Date().getTime() + (data.expires_in * 1000);
      returnedState = data.state;
      if (returnedState != generatedState) {
        // TODO: Handle this error
        throw new Error("CSRF token does not match");
      }
    });

  googleOauth.accessToken = accessToken;
  googleOauth.expiresOn = expiresOn;
  googleOauth.idToken = idToken;
  if (refreshToken) {
    googleOauth.refreshToken = refreshToken;
  }
  await chrome.storage.local.set({ "googleOauth": googleOauth });

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

export async function openStripeCheckout() {
  const currentUser = await getUser(false);
  // console.log(currentUser);

  // const products = await getProducts();
  // console.log(products);

  // // TODO: This must be done without reliance on the name being the same in case it changes
  // const monthlyPrice = products.find(p => p.name === "One Month of Shuffle+");
  // const yearlyPrice = products.find(p => p.name === "One Year of Shuffle+");

  // // For testing, assume a monthly subscription
  // let checkoutSessionData = {
  //   price: monthlyPrice.priceId,
  //   // success_url: window.location.origin, // can set this to a custom page
  //   // cancel_url: window.location.origin   // can set this to a custom page
  // };

  // const checkoutSessionRef = await addDoc(
  //   // currentUser is provided by firebase, via getAuth().currentUser
  //   collection(db, `customers/${currentUser.uid}/checkout_sessions`),
  //   checkoutSessionData
  // );

  // // The Stripe extension creates a payment link for us
  // onSnapshot(checkoutSessionRef, (snap) => {
  //   const { error, url } = snap.data();
  //   if (error) {
  //     // handle error
  //   }
  //   if (url) {
  //     window.location.assign(url);  // redirect to payment link
  //   }
  // });
}