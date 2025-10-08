"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Header() {
	return (
		<header className="w-full border-b flex items-center justify-between px-4 py-3">
			<nav className="flex items-center gap-4 text-sm">
				<Link href="/" className="sp-btn">Home</Link>
				<Link href="/miner" className="sp-btn">Miner</Link>
				<Link href="/launch" className="sp-btn">Launch</Link>
			</nav>
			<ConnectButton />
		</header>
	);
}


