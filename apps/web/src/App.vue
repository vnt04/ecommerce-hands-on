<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { formatVnd } from '@shopflow/shared';

type HealthResponse = { status: string };

const apiStatus = ref('đang kiểm tra...');

// Gọi formatVnd ngay khi dựng component để xác nhận web phân giải được
// package shared. Nếu workspace nối sai, trang sẽ không dựng được.
const sampleAmount = formatVnd(299000n);

onMounted(async () => {
  try {
    const response = await fetch('/api/healthz');

    if (!response.ok) {
      apiStatus.value = `lỗi HTTP ${response.status}`;
      return;
    }

    const body = (await response.json()) as HealthResponse;
    apiStatus.value = body.status;
  } catch {
    apiStatus.value = 'không kết nối được';
  }
});
</script>

<template>
  <main>
    <h1>ShopFlow</h1>
    <dl>
      <dt>API /healthz</dt>
      <dd>{{ apiStatus }}</dd>

      <dt>shared.formatVnd(299000n)</dt>
      <dd>{{ sampleAmount }}</dd>
    </dl>
  </main>
</template>

<style>
main {
  max-width: 40rem;
  margin: 3rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}

dt {
  font-weight: 600;
  margin-top: 1rem;
}
</style>
