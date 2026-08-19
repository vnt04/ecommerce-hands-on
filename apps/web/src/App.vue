<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { formatVnd, type Envelope } from '@shopflow/shared';

type LivenessData = { status: string };

const apiStatus = ref('đang kiểm tra...');

// Gọi formatVnd ngay khi dựng component để xác nhận web phân giải được
// package shared. Nếu workspace nối sai, trang sẽ không dựng được.
const sampleAmount = formatVnd(299000n);

onMounted(async () => {
      try {
            const response = await fetch('/api/v1/healthz');
            const body = (await response.json()) as Envelope<LivenessData>;

            // Frontend ra quyết định dựa trên cờ success và mã lỗi, không bao giờ
            // dựa trên nội dung message.
            apiStatus.value = body.success ? body.data.status : body.error.code;
      } catch {
            apiStatus.value = 'không kết nối được';
      }
});
</script>

<template>
      <main>
            <h1>ShopFlow</h1>
            <dl>
                  <dt>API /api/v1/healthz</dt>
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
