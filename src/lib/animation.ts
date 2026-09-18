// Thời lượng animation dùng chung — cùng một nguồn cho cả CSS (định nghĩa trong
// index.css) và JS (thời gian dọn state sau khi animation kết thúc), tránh lệch nhịp.
export const MOVE_SLIDE_MS = 250;
export const CAPTURE_IMPACT_DELAY_MS = 180;
export const CAPTURE_DEATH_MS = 380;
export const CAPTURE_CLEANUP_MS = CAPTURE_IMPACT_DELAY_MS + CAPTURE_DEATH_MS + 80;
export const PROMOTE_DELAY_MS = 150;
export const PROMOTE_EFFECT_MS = 550;
export const PROMOTE_CLEANUP_MS = PROMOTE_DELAY_MS + PROMOTE_EFFECT_MS + 80;
export const CHECK_FLASH_MS = 900;
