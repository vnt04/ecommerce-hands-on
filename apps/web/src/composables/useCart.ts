import type { CartMutationResult, CartView } from '@shopflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, type ComputedRef, type Ref } from 'vue';

import * as cartApi from '../api/cart.js';

/**
 * Một khoá duy nhất cho giỏ hàng.
 *
 * Header, trang chi tiết và trang giỏ cùng đọc khoá này, nên chỉ có một bản dữ
 * liệu trong bộ nhớ đệm. Thêm hàng ở trang chi tiết là số trên header đổi theo,
 * không cần bất kỳ dây nối nào giữa hai chỗ đó.
 */
export const CART_QUERY_KEY = ['cart'];

const EMPTY_CART: CartView = { lines: [], subtotal: '0', itemCount: 0 };

export type UseCartResult = {
      cart: ComputedRef<CartView>;
      isPending: Ref<boolean>;
      error: Ref<Error | null>;
      /** Thông báo cần cho khách biết sau thao tác gần nhất, ví dụ khi số lượng bị chặn. */
      notice: Ref<string | undefined>;
      isMutating: ComputedRef<boolean>;
      addItem: (sku: string, quantity: number) => Promise<void>;
      updateQuantity: (sku: string, quantity: number) => Promise<void>;
      removeItem: (sku: string) => Promise<void>;
      dismissNotice: () => void;
};

export function useCart(): UseCartResult {
      const queryClient = useQueryClient();
      const notice = ref<string | undefined>(undefined);

      const query = useQuery({
            queryKey: CART_QUERY_KEY,
            queryFn: cartApi.fetchCart,
      });

      /**
       * Ghi thẳng kết quả trả về vào bộ nhớ đệm thay vì đánh dấu cũ rồi gọi lại.
       *
       * Mỗi thao tác ghi đã trả về nguyên giỏ sau thay đổi, nên gọi thêm một lượt
       * GET là thừa một vòng mạng, và trong khoảng chờ đó màn hình hiện số cũ.
       */
      function applyResult(result: CartMutationResult): void {
            queryClient.setQueryData(CART_QUERY_KEY, result.cart);

            notice.value =
                  result.adjustedQuantity === undefined
                        ? undefined
                        : 'Kho chỉ còn ' + result.adjustedQuantity + ' sản phẩm. Số lượng trong giỏ đã được điều chỉnh.';
      }

      const addMutation = useMutation({
            mutationFn: ({ sku, quantity }: { sku: string; quantity: number }) => cartApi.addCartItem(sku, quantity),
            onSuccess: applyResult,
      });

      const updateMutation = useMutation({
            mutationFn: ({ sku, quantity }: { sku: string; quantity: number }) => cartApi.updateCartItem(sku, quantity),
            onSuccess: applyResult,
      });

      const removeMutation = useMutation({
            mutationFn: (sku: string) => cartApi.removeCartItem(sku),
            onSuccess: (cart: CartView) => {
                  queryClient.setQueryData(CART_QUERY_KEY, cart);
                  notice.value = undefined;
            },
      });

      return {
            // Chưa tải xong thì coi như giỏ rỗng, để giao diện không phải kiểm tra
            // undefined ở mọi nơi dùng tới.
            cart: computed(() => query.data.value ?? EMPTY_CART),
            isPending: query.isPending,
            error: query.error,
            notice,
            isMutating: computed(() => addMutation.isPending.value || updateMutation.isPending.value || removeMutation.isPending.value),
            addItem: async (sku, quantity) => {
                  await addMutation.mutateAsync({ sku, quantity });
            },
            updateQuantity: async (sku, quantity) => {
                  await updateMutation.mutateAsync({ sku, quantity });
            },
            removeItem: async (sku) => {
                  await removeMutation.mutateAsync(sku);
            },
            dismissNotice: () => {
                  notice.value = undefined;
            },
      };
}
