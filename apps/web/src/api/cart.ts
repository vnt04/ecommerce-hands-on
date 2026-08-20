import type { CartMutationResult, CartView } from '@shopflow/shared';

import { apiDelete, apiGet, apiPatch, apiPost } from './client.js';

export function fetchCart(): Promise<CartView> {
      return apiGet<CartView>('/cart').then((result) => result.data);
}

export function addCartItem(sku: string, quantity: number): Promise<CartMutationResult> {
      return apiPost<CartMutationResult>('/cart/items', { sku, quantity }).then((result) => result.data);
}

export function updateCartItem(sku: string, quantity: number): Promise<CartMutationResult> {
      return apiPatch<CartMutationResult>('/cart/items/' + encodeURIComponent(sku), { quantity }).then((result) => result.data);
}

export function removeCartItem(sku: string): Promise<CartView> {
      return apiDelete<CartView>('/cart/items/' + encodeURIComponent(sku)).then((result) => result.data);
}
