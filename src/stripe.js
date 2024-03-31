// Contains logic for interacting with Stripe for payment handling
import { firebaseConfig } from "./config.js";
import { getUser } from './googleOauth.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get products and pricing information from Firestore/Stripe
async function getProducts(currency = 'usd') {
	const q = query(
		collection(db, 'products'),
		where('active', '==', true)
	);

	const querySnapshot = await getDocs(q);

	// For each product, get the product price info
	const productsPromises = querySnapshot.docs.map(async (productDoc) => {
		let productInfo = productDoc.data();

		// If the product's currency doesn't match the given currency, skip this product
		if (productInfo.metadata.currency !== currency) {
			return null;
		}

		// Fetch prices subcollection per product
		const pricesCollection = collection(productDoc.ref, 'prices');
		const priceQuerySnapshot = await getDocs(pricesCollection);

		// Iterate over all price documents and filter by currency
		const pricesInfo = priceQuerySnapshot.docs.map((priceDoc) => {
			const priceInfo = priceDoc.data();
			return priceInfo.currency === currency ? { priceId: priceDoc.id, priceInfo } : null;
		}).filter(price => price !== null);

		// If no prices in the given currency, get the USD price
		if (pricesInfo.length === 0) {
			const usdPrice = priceQuerySnapshot.docs.find((priceDoc) => priceDoc.data().currency === 'usd');
			if (usdPrice) {
				pricesInfo.push({
					priceId: usdPrice.id,
					priceInfo: usdPrice.data()
				});
			}
		}

		productInfo['prices'] = pricesInfo;
		return productInfo;
	});

	const products = await Promise.all(productsPromises);

	return products.filter(product => product !== null);
}

export async function openStripeCheckout(currency = 'usd') {
	const currentUser = await getUser(false);
	const products = await getProducts(currency);

	// TODO: This must be done without reliance on the name being the same in case it changes
	// In theory, there should always only be one matching product returned by getProducts
	const shufflePlusTestProducts = products.find(p => p.name == "Shuffle+ (Test)");
	// const shufflePlusProduct = products.find(p => p.name == "Shuffle+");

	// Get the available prices, which is a subkey prices on the product
	const shufflePlusTestProductPrices = shufflePlusTestProducts.prices;

	// For testing, use the monthly price
	let checkoutSessionData = {
		price: shufflePlusTestProductPrices.find(p => p.priceInfo.type === 'recurring' && p.priceInfo.recurring.interval === 'month').priceId,
		// TODO: Proper redirect URL, cancellation URL
		success_url: 'https://tinyurl.com/RYVShufflePlus',
		allow_promotion_codes: true
	};

	const checkoutSessionRef = await addDoc(
		// currentUser is provided by firebase, via getAuth().currentUser
		collection(db, `users/${currentUser.firebaseUid}/checkout_sessions`),
		checkoutSessionData
	);

	// The Stripe extension creates a payment link for us
	onSnapshot(checkoutSessionRef, (snap) => {
		const { error, url } = snap.data();
		if (error) {
			console.error(error);
			// TODO: Handle error
		}
		if (url) {
			// TODO: Decide whether to open a new tab or redirect the current tab
			chrome.tabs.create({ url });
			// window.location.assign(url);
		}
	});
}

// Gets all (active) subscriptions for the current user
export async function getSubscriptions(activeOnly = true) {
	const currentUser = await getUser(false);
	if (!currentUser) {
		console.log("No user found");
		return [];
	}

	let q;
	if (activeOnly) {
		q = query(
			collection(db, `users/${currentUser.firebaseUid}/subscriptions`),
			where('status', 'in', ['active', 'trialing'])
		);
	} else {
		q = collection(db, `users/${currentUser.firebaseUid}/subscriptions`);
	}

	const querySnapshot = await getDocs(q);
	const subscriptions = querySnapshot.docs.map((doc) => doc.data());
	return subscriptions;
}