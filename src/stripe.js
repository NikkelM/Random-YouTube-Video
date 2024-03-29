// Contains logic for interacting with Stripe for payment handling
import { firebaseConfig } from "./config.js";
import { getUser } from './googleOauth.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs } from 'firebase/firestore';

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
