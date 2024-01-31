
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';

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

export async function googleLogin() {
  // TODO: If we still have a refresh token, use it to get a new access token

  const randomPool = crypto.getRandomValues(new Uint8Array(32));
  let state = '';
  for (let i = 0; i < randomPool.length; ++i) {
    state += randomPool[i].toString(16);
  }
  await chrome.storage.local.set({ "latestCSRFToken": state });

  chrome.identity.launchWebAuthFlow({
    'url': `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&state=${state}&client_id=141257152664-9ps6uugd281t3b581q5phdl1qd245tcf.apps.googleusercontent.com&redirect_uri=https://kijgnjhogkjodpakfmhgleobifempckf.chromiumapp.org/&scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/youtube.readonly`,
    'interactive': true
  }, async function (redirect_url) {
    console.log(redirect_url);
    // Get the token from the redirect URL
    const returnedState = redirect_url.split("state=")[1].split("&")[0];
    const returnedCode = redirect_url.split("code=")[1].split("&")[0];

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

    // Allowed actions are codeExchange and refreshTokenExchange. The code or refresh token must be provided in the token parameter
    let access_token, refresh_token, expiresIn, state;
    await fetch(`https://europe-west1-random-youtube-video-ex-chrome.cloudfunctions.net/google-oauth-token-exchange?action=codeExchange&token=${returnedCode}&state=${returnedState}`)
      .then(response => response.json())
      .then(data => {
        console.log(data);
        access_token = data.access_token;
        refresh_token = data.refresh_token;
        expiresIn = data.expires_in;
        state = data.state;
        if(state !== returnedState) {
          throw new Error("CSRF token does not match");
        }
      });
      console.log(access_token, refresh_token, expiresIn);
      // Save the tokens in local storage
      await chrome.storage.local.set({ "access_token": access_token });
      await chrome.storage.local.set({ "refresh_token": refresh_token });
      await chrome.storage.local.set({ "expiresIn": expiresIn }); // TODO: Convert this to a timestamp
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