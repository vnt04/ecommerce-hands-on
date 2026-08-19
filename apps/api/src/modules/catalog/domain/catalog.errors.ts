/**
 * Lỗi nghiệp vụ của catalog. Tách thành lớp riêng để tầng HTTP ánh xạ sang mã lỗi
 * và trạng thái phù hợp, thay vì để mọi thứ rơi vào nhánh lỗi 500.
 */
export class InvalidDesignCodeError extends Error {
      constructor(designCode: string) {
            super(`Mã thiết kế không hợp lệ: ${designCode}`);
            this.name = 'InvalidDesignCodeError';
      }
}

export class EmptyVariantMatrixError extends Error {
      constructor(missing: 'màu' | 'size') {
            super(`Không sinh được ma trận biến thể: thiếu tập ${missing}`);
            this.name = 'EmptyVariantMatrixError';
      }
}

export class DuplicateVariantAxisError extends Error {
      constructor(axis: 'màu' | 'size', value: string) {
            super(`Tập ${axis} có giá trị trùng: ${value}`);
            this.name = 'DuplicateVariantAxisError';
      }
}
