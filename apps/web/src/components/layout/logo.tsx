/** Dấu nhận diện: ô khung tên với góc đỏ ở dưới bên phải. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 border-2 border-ink"
      style={{ width: size, height: size, gridTemplateRows: `1fr ${Math.round(size / 3)}px` }}
    >
      <span />
      <span
        className="grid border-t-2 border-ink"
        style={{ gridTemplateColumns: `1fr ${Math.round(size / 3)}px` }}
      >
        <span />
        <span className="border-l-2 border-ink bg-stamp" />
      </span>
    </span>
  );
}
