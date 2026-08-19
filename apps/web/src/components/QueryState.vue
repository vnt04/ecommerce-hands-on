<script setup lang="ts">
/**
 * Bốn trạng thái của một vùng có dữ liệu: đang tải, lỗi, rỗng, có dữ liệu.
 *
 * Gom vào một chỗ để không màn hình nào quên một trạng thái. Thiếu trạng thái lỗi
 * là trang trắng không giải thích gì; thiếu trạng thái rỗng là khách tưởng trang hỏng.
 */
defineProps<{
      isPending: boolean;
      error: Error | null;
      isEmpty: boolean;
      emptyMessage?: string;
}>();
</script>

<template>
      <p v-if="isPending" class="py-12 text-center text-gray-500" role="status">Đang tải…</p>

      <div v-else-if="error" class="rounded border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p class="font-semibold">Không tải được dữ liệu</p>
            <p class="mt-1 text-sm">{{ error.message }}</p>
      </div>

      <p v-else-if="isEmpty" class="py-12 text-center text-gray-500">
            {{ emptyMessage ?? 'Không có dữ liệu' }}
      </p>

      <slot v-else />
</template>
