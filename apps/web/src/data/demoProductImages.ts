/** Hình catalog demo local; ảnh production có thể được quản lý từ trang quản trị. */
const DEMO_PRODUCT_IMAGES: Record<string, string> = {
      'tee-sunset': '/images/demo/tee-sunset.png',
      'tee-mountain': '/images/demo/tee-mountain.png',
      'tee-coastline': '/images/demo/tee-coastline.png',
      'tee-botanical': '/images/demo/tee-botanical.png',
      'tee-orbit': '/images/demo/tee-orbit.png',
      'tee-arch': '/images/demo/tee-arch.png',
};

const DEMO_EDITION_IMAGES = [
      '/images/demo/tee-sunset.png',
      '/images/demo/tee-mountain.png',
      '/images/demo/tee-coastline.png',
      '/images/demo/tee-botanical.png',
      '/images/demo/tee-orbit.png',
      '/images/demo/tee-arch.png',
];

export function demoProductImage(slug: string): string | undefined {
      const image = DEMO_PRODUCT_IMAGES[slug];

      if (image !== undefined) {
            return image;
      }

      const edition = /^tee-demo-(\d{3})$/.exec(slug);

      return edition === null ? undefined : DEMO_EDITION_IMAGES[(Number(edition[1]) - 1) % DEMO_EDITION_IMAGES.length];
}
