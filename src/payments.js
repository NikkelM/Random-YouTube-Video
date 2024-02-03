
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "firebase/auth";

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

// Get a Google accessToken, and save relevant data locally
export async function googleLogin() {
  const auth = getAuth(app);
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Signed in successfully!");
      const uid = user.uid;

      // Save the user's uid to sync storage
      await chrome.storage.sync.set({ "userID": uid });
    } else {
      console.log("Signed out successfully, or the sign in flow was started!");
    }
  });

  let googleOauth = (await chrome.storage.local.get("googleOauth")).googleOauth || {};

  // The access token should be valid for at least another 5 minutes
  if (googleOauth.accessToken && googleOauth.expiresOn > new Date().getTime() + 300000) {
    console.log("Using cached access token");
    // Login the user to Firebase
    const credential = GoogleAuthProvider.credential(googleOauth.idToken, googleOauth.accessToken);
    await signInWithCredential(auth, credential);

    if (!googleOauth.refreshToken) {
      await fetchRefreshTokenFromFirestore(googleOauth);
    }

    return googleOauth;
  } else {
    let generatedState = "";
    while (generatedState.length < 32) {
      (generatedState += Math.random().toString(36).slice(2)).substring(2, 34);
    }

    let action, passedToken;

    if (googleOauth.refreshToken) {
      console.log("Exchanging refresh token for access token");
      action = "refreshTokenExchange";
      passedToken = googleOauth.refreshToken;

      await runGoogleOauthAuthentication(action, passedToken, generatedState, googleOauth, auth);
    } else {
      console.log("Using code exchange, as there is no access or refresh token available.");
      action = "codeExchange";
      // TODO: Use the chrome native login flow if it's available? Is there an upside to this?
      chrome.identity.launchWebAuthFlow({
        'url': `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=${generatedState}&client_id=141257152664-9ps6uugd281t3b581q5phdl1qd245tcf.apps.googleusercontent.com&redirect_uri=https://kijgnjhogkjodpakfmhgleobifempckf.chromiumapp.org/&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/youtube.readonly`,
        'interactive': true
      }, async function (redirect_url) {
        const returnedState = redirect_url.split("state=")[1].split("&")[0];
        passedToken = redirect_url.split("code=")[1].split("&")[0];

        if (generatedState != returnedState) {
          // TODO: Handle this error
          console.log("CSRF token does not match");
          throw new Error("CSRF token does not match");
        }

        console.log("Exchanging code for access token");
        await runGoogleOauthAuthentication(action, passedToken, generatedState, googleOauth, auth);
      });
    }
  }
}

// Gets the Google Oauth refresh token for the current user from Firestore and saves it locally
async function fetchRefreshTokenFromFirestore(googleOauth) {
  console.log("Getting the Google Oauth refresh token from Firestore, as it does not exist locally.");
  const userRef = doc(db, "users", getAuth().currentUser.uid);
  const userDoc = await getDoc(userRef);
  if (userDoc.exists()) {
    const data = userDoc.data();
    if (data.refreshToken) {
      googleOauth.refreshToken = data.refreshToken;
      await chrome.storage.local.set({ "googleOauth": googleOauth });
    }
  }
}

// Exchanges a code or refresh token for an access token using the backend Google Cloud Function
async function runGoogleOauthAuthentication(action, passedToken, generatedState, googleOauth, auth) {
  let accessToken, refreshToken, idToken, expiresOn, state;
  // Get an access, refresh and id token
  await fetch(`https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange?action=${action}&token=${passedToken}&state=${generatedState}`)
    .then(response => response.json())
    .then(data => {
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      idToken = data.id_token;
      expiresOn = new Date().getTime() + (data.expires_in * 1000);
      state = data.state;
      if (state != generatedState) {
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
      refreshToken: refreshToken
    }, { merge: true });
  } else if (!googleOauth.refreshToken) {
    await fetchRefreshTokenFromFirestore(googleOauth);
  }
}

export async function openStripeCheckout() {
  const currentUser = await googleLogin();
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