import Link from "next/link";
import Image from "next/image";

/**
 * variant "mark": small, for the sticky portal header — height-constrained
 * so it sits inline next to the portal chip without pushing the header tall.
 * variant "full": larger, for the signed-out hero/auth pages where the
 * logo is the visual anchor of the page.
 */
export function Brand({ href = "/", variant = "mark" }: { href?: string; variant?: "mark" | "full" }) {
  if (variant === "full") {
    return (
      <Link href={href} className="brand" style={{ display: "inline-block", textDecoration: "none" }}>
        <Image
          src="/logo.png"
          alt="FreshNest — Fresh Care, Cozy Comfort"
          width={640}
          height={640}
          priority
          style={{ width: 132, height: "auto", display: "block" }}
        />
      </Link>
    );
  }

  return (
    <Link href={href} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
      <Image
        src="/logo.png"
        alt="FreshNest"
        width={640}
        height={640}
        style={{ width: 40, height: 40, objectFit: "cover", objectPosition: "top", borderRadius: 9 }}
      />
    </Link>
  );
}
