import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2 font-head text-[15px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-50 hover:no-underline",
  {
    variants: {
      variant: {
        // Hành động chính: nền đỏ dấu duyệt, mỗi màn hình chỉ một nút
        primary: "border-ink bg-stamp text-stamp-ink hover:bg-ink hover:text-paper",
        ink: "border-ink bg-ink text-paper hover:bg-stamp hover:text-stamp-ink",
        outline: "border-ink bg-sheet text-ink hover:bg-wash hover:text-ink",
        ghost: "border-transparent bg-transparent text-ink hover:bg-wash hover:text-ink",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4",
        lg: "h-13 px-6 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
