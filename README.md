# Chuong's Chess

Ứng dụng cờ vua chạy hoàn toàn trong trình duyệt: đấu với máy, gợi ý nước đi kèm lý do,
và chấm điểm lại cả ván sau khi chơi xong.

## Engine

Máy đối thủ, gợi ý và chấm điểm ván đấu đều dùng **Stockfish 19 (bản WASM lite, đơn luồng)**
nằm ở `public/engine/`.

- Chọn bản *lite single-threaded* (~1,8MB) thay vì bản đầy đủ (~94MB): vẫn mạnh hơn mọi
  người chơi, mà không cần header `COOP`/`COEP` — nghĩa là deploy được lên cả GitHub Pages.
- File engine **không đi qua bundler**. Nó là asset tĩnh trong `public/`, chỉ được tải ở
  lần đầu cần đến, nên ván 2 người không bật gợi ý sẽ không tải một byte engine nào.
- Chỉ có một instance engine dùng chung cho cả ba tính năng (`src/lib/engine/stockfish.ts`),
  các yêu cầu được xếp hàng — engine mỗi lúc chỉ chạy được một lệnh tìm kiếm.
- Độ khó đặt bằng `UCI_Elo` (1320 / 1800 / 2400) thay vì giới hạn độ sâu, xem
  `src/lib/engine/difficulty.ts`.

Stockfish chỉ trả về nước đi và điểm số, không giải thích. Phần giải thích *vì sao* một
nước tốt nằm ở `src/lib/moveHint.ts` — đọc bàn cờ qua chess.js để phát hiện ăn quân treo,
cứu quân, bắt đôi, chiếu hết... nên lý do luôn là sự thật kiểm chứng được trên bàn cờ.

### Giấy phép

Stockfish phát hành theo **GPLv3** (xem `public/engine/LICENSE-stockfish.txt`). Vì bản
build có kèm engine, nếu phân phối ứng dụng này thì cũng phải tuân theo GPLv3 — tức là
công khai mã nguồn của ứng dụng.

### Cập nhật engine

Tải hai file `stockfish-19-lite-single.js` và `stockfish-19-lite-single.wasm` từ
[releases của stockfish.js](https://github.com/nmrugg/stockfish.js/releases) vào
`public/engine/`, rồi sửa hằng `ENGINE_SCRIPT` trong `src/lib/engine/stockfish.ts` nếu tên
file đổi.

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
