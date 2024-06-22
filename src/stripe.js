// Contains logic for interacting with Stripe for payment handling
import { firebaseConfig } from "./config.js";
import { getUser } from "./googleOauth.js";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot, FieldPath } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

// Get products and pricing information from Firestore/Stripe
async function getProducts(currency) {
	const currencyRef = new FieldPath("metadata", "currency");
	const productCurrencyQuery = query(
		collection(firestore, "products"),
		where("active", "==", true),
		where(currencyRef, "==", currency)
	);

	const productSnapshot = await getDocs(productCurrencyQuery);

	// For each product, get the product price info
	const productsPromises = productSnapshot.docs.map(async (productDoc) => {
		let productInfo = productDoc.data();

		// Fetch prices subcollection per product
		const priceQuerySnapshot = await getDocs(collection(productDoc.ref, "prices"));

		// Iterate over all price documents and filter by currency
		// Even though we already filtered by currency in the product query, we filter again here to make sure to only get correct prices
		const pricesInfo = priceQuerySnapshot.docs.map((priceDoc) => {
			const priceInfo = priceDoc.data();
			return (priceInfo.currency == currency) ? { priceId: priceDoc.id, priceInfo } : null;
		}).filter(price => price !== null);

		productInfo["prices"] = pricesInfo;
		return productInfo;
	});

	const products = await Promise.all(productsPromises);

	// If no products with the requested currency are found, return products with USD pricing
	if (products.length == 0) {
		console.log(`No products found with currency ${currency}, trying to get products with USD pricing.`);
		return getProducts("usd");
	}

	return {
		products: products.filter(product => product !== null),
		currency: currency
	};
}

export async function openStripeCheckout(user, requestedProduct, requestedCurrency, requestedInterval, requestedIntervalCount) {
	user ??= await getUser(false, true, true);
	// TODO: Do we want to scope to requestedProduct in getProducts as well?
	// In case the requested currency is not available, we default to USD
	const { products, currency } = await getProducts(requestedCurrency);

	// In theory, there should always only be one matching product returned by getProducts
	const shufflePlusTestProducts = products.find(p => p.name == requestedProduct);

	let paymentMethods = ["paypal", "card", "link"];

	let checkoutSessionData = {
		price: shufflePlusTestProducts.prices.find(
			p =>
				p.priceInfo.active &&
				p.priceInfo.type == "recurring" &&
				p.priceInfo.recurring.interval == requestedInterval &&
				// If using the monthly interval, get the requested kind
				(requestedInterval == "year" || p.priceInfo.recurring.interval_count == requestedIntervalCount)
		).priceId,
		// TODO: Proper success URL, cancellation URL. Redirect to either Github or nikkelm.dev, if redirecting to extension is not possible?
		//chrome runtime URL's are not valid for Stripe
		// current success_url does nothing after completion (users stays on stripe checkout page)
		success_url: "https://tinyurl.com/RYVShufflePlus?sessionId={CHECKOUT_SESSION_ID}", //chrome.runtime.getURL("html/shufflePlus.html"), 
		// cancel_url is optional
		// cancel_url: "https://google.com?sessionId={CHECKOUT_SESSION_ID}", //chrome.runtime.getURL("html/shufflePlus.html"), 
		allow_promotion_codes: true,
		payment_method_types: paymentMethods
	};

	const checkoutSessionRef = await addDoc(
		collection(firestore, `users/${user.userInfo.firebaseUid}/checkout_sessions`),
		checkoutSessionData
	);

	let hasOpenedCheckoutTab = false;
	// The Stripe extension creates a payment link for us
	onSnapshot(checkoutSessionRef, (snap) => {
		const { error, url } = snap.data();
		if (error) {
			console.error(error);
			// TODO: Handle error
		}
		if (url) {
			// TODO: Decide whether to open a new tab or redirect the current tab
			hasOpenedCheckoutTab = true;
			chrome.tabs.create({ url });
			// window.location.assign(url);
		}
	});

	let hasTimedOut = false;
	setTimeout(() => {
		hasTimedOut = true;
	}, 5000);

	while (!hasOpenedCheckoutTab && !hasTimedOut) {
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	return hasOpenedCheckoutTab;
}

// Gets all (active) subscriptions for the current user
export async function getSubscriptions(user = null, activeOnly = true) {
	user ??= await getUser(false, true, false);
	if (!user) {
		console.log("No user found");
		return [];
	}

	let q;
	if (activeOnly) {
		q = query(
			collection(firestore, `users/${user.userInfo.firebaseUid}/subscriptions`),
			where("status", "in", ["active", "trialing"])
		);
	} else {
		q = collection(firestore, `users/${user.userInfo.firebaseUid}/subscriptions`);
	}

	const querySnapshot = await getDocs(q);
	const subscriptions = querySnapshot.docs.map((doc) => doc.data());
	return subscriptions;
}

export async function userHasActiveSubscriptionRole(user = null) {
	const stripeRole = await getStripeRole(user);
	return stripeRole == "shufflePlus";
}

// This will return "shufflePlus" if the user has an active subscription
async function getStripeRole(_user = null) {
	_user ??= await getUser(false, true, false);
	const decodedToken = await getAuth().currentUser?.getIdTokenResult();
	return decodedToken?.claims?.stripeRole ?? null;
}
