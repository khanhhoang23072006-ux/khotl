import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HUSTDOCU",
    short_name: "HUSTDOCU",
    description: "Tài liệu học tập do sinh viên Bách khoa chia sẻ, đã qua kiểm duyệt.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f5",
    theme_color: "#1b1f23",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
