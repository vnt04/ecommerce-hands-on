/** Hình minh họa local cho seed hiện tại; thay qua quản trị khi có ảnh thật. */
const DEMO_PRODUCT_IMAGES: Record<string, string> = {
      'tee-sunset': '/images/demo/tee-sunset.png',
      'tee-mountain': '/images/demo/tee-mountain.png',
};

export function demoProductImage(slug: string): string | undefined {
      return DEMO_PRODUCT_IMAGES[slug];
}
