/**
 * Store purchases through RevenueCat (App Store and Google Play subscriptions).
 *
 * - The app logs in to RevenueCat with our user id: the backend webhook then knows who
 *   bought, and gives Plus to the whole couple (one subscription for two).
 * - Without a RevenueCat key (Expo Go, local dev) nothing is called: the paywall says
 *   purchases open with the installed app instead of failing.
 * Keys are public SDK keys (EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY), not secrets.
 */
import { Linking, Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

/** Entitlement identifier configured in RevenueCat for Bolingo Plus. */
export const ENTITLEMENT = 'plus';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const MANAGE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

/** Apple's standard licence agreement, required next to the terms for subscriptions. */
export const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export type Plan = {
  id: string;
  period: 'monthly' | 'yearly';
  price: string;
  /** Free trial or intro price offered by the store, if any (e.g. "7 jours gratuits"). */
  intro: { price: string; periodNumberOfUnits: number; periodUnit: string } | null;
  pkg: PurchasesPackage;
};

let configuredFor: string | null = null;

export function purchasesAvailable(): boolean {
  return Boolean(KEY);
}

/** Configures the SDK for this person (once), or switches person after a new sign-in. */
export async function identify(userId: number | string): Promise<void> {
  if (!KEY) return;
  const id = String(userId);
  if (configuredFor === null) {
    Purchases.configure({ apiKey: KEY, appUserID: id });
    configuredFor = id;
  } else if (configuredFor !== id) {
    await Purchases.logIn(id);
    configuredFor = id;
  }
}

/** Signed out: purchases are no longer tied to that person on this phone. */
export async function forget(): Promise<void> {
  if (!KEY || configuredFor === null) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous: nothing to forget.
  }
  configuredFor = null;
}

/** The monthly and yearly plans of the current offering, with store-localised prices. */
export async function loadPlans(): Promise<Plan[]> {
  if (!KEY) return [];
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const plans: Plan[] = [];
  for (const pkg of packages) {
    const period =
      pkg.packageType === 'MONTHLY' ? 'monthly' : pkg.packageType === 'ANNUAL' ? 'yearly' : null;
    if (!period) continue;
    const intro = pkg.product.introPrice;
    plans.push({
      id: pkg.identifier,
      period,
      price: pkg.product.priceString,
      intro: intro
        ? {
            price: intro.priceString,
            periodNumberOfUnits: intro.periodNumberOfUnits,
            periodUnit: intro.periodUnit,
          }
        : null,
      pkg,
    });
  }
  return plans.sort((a, b) => (a.period === b.period ? 0 : a.period === 'yearly' ? -1 : 1));
}

export type BuyResult = 'bought' | 'cancelled';

export async function buy(plan: Plan): Promise<BuyResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return customerInfo.entitlements.active[ENTITLEMENT] ? 'bought' : 'cancelled';
  } catch (error) {
    if ((error as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw error;
  }
}

/** Restores a subscription bought on another phone or before reinstalling. */
export async function restore(): Promise<boolean> {
  if (!KEY) return false;
  const info = await Purchases.restorePurchases();
  return Boolean(info.entitlements.active[ENTITLEMENT]);
}

export async function openManage(): Promise<void> {
  await Linking.openURL(MANAGE_URL);
}

/** Plus paid or offered until a future date (the couple's shared `plus_until`). */
export function isPlusActive(until: string | null | undefined, now: number): boolean {
  return Boolean(until && new Date(until).getTime() > now);
}
