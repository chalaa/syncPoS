"use client";

import { useRouter } from "next/navigation";
import type { HTMLAttributes, ReactNode } from "react";

export type ClickableTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  href?: string;
  onClickRow?: () => void;
  children: ReactNode;
};

export function ClickableTableRow({
  href,
  onClickRow,
  className = "",
  children,
  onClick,
  ...props
}: ClickableTableRowProps) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [role='button']")) {
      return;
    }

    if (onClick) {
      onClick(e);
    }

    if (onClickRow) {
      onClickRow();
    } else if (href) {
      router.push(href);
    }
  }

  return (
    <tr
      {...props}
      onClick={handleClick}
      className={`group cursor-pointer transition-colors hover:bg-muted/50 ${className}`}
    >
      {children}
    </tr>
  );
}
