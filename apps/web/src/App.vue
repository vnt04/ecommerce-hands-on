<script setup lang="ts">
// Khung ngoài của ứng dụng. Nội dung từng trang do router quyết định.
</script>

<template>
      <div class="min-h-screen bg-white font-sans text-gray-900">
            <header class="border-b border-gray-200">
                  <div class="mx-auto max-w-5xl px-4 py-4">
                        <RouterLink to="/" class="text-xl font-bold text-brand">ShopFlow</RouterLink>
                  </div>
            </header>

            <main class="mx-auto max-w-5xl px-4 py-8">
                  <RouterView />
            </main>
      </div>
</template>
