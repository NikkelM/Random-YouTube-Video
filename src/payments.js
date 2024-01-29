
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "firebase/auth";

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

// TODO: Add domains for Firefox and Edge stores to authorized domains in Firebase console
// User authentication using Google
// const auth = getAuth(app);
// const provider = new GoogleAuthProvider();
// provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
// auth.useDeviceLanguage();

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

export async function googleLogin() {
  const randomPool = crypto.getRandomValues(new Uint8Array(32));
  let state = '';
  for (let i = 0; i < randomPool.length; ++i) {
    state += randomPool[i].toString(16);
  }
  await chrome.storage.local.set({ "latestCSRFToken": state });

  chrome.identity.launchWebAuthFlow({
    'url': `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=${state}&client_id=141257152664-9ps6uugd281t3b581q5phdl1qd245tcf.apps.googleusercontent.com&redirect_uri=https://kijgnjhogkjodpakfmhgleobifempckf.chromiumapp.org/&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/youtube.readonly`,
    'interactive': true
  }, function (redirect_url) {
    console.log(redirect_url);
    // Get the token from the redirect URL
    const returnedState = redirect_url.split("state=")[1].split("&")[0];
    const returnedCode = redirect_url.split("code=")[1].split("&")[0];
    console.log(returnedState);
    console.log(returnedCode);
    // Check if the returned state matches the one we sent
    chrome.storage.local.get("latestCSRFToken", function (result) {
      console.log(result);
      if (result.latestCSRFToken === returnedState) {
        console.log("CSRF token matches");
      } else {
        console.log("CSRF token does not match");
        throw new Error("CSRF token does not match");
      }
    });
    /*
    Next, get an access and refresh token
    Note that the client secret cannot be exposed, so we need to proxy this through firebase functions
    code=xxx&redirect_uri=https%3A%2F%2Fdevelopers.google.com%2Foauthplayground&client_id=407408718192.apps.googleusercontent.com&client_secret=************&scope=&grant_type=authorization_code
    */
    // fetch result from https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange
    fetch(`https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange?code=${returnedCode}&state=${returnedState}`)
      .then(response => response.json())
      .then(data => {
        console.log(data);
      });
  });
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