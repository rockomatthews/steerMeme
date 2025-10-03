"use client";

import { ReactNode } from "react";
import { WagmiProvider, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { base, baseSepolia } from "wagmi/chains";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

const config = getDefaultConfig({
	appName: "SteerMeme",
	projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
	chains: [base, baseSepolia],
	transports: {
		[base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
		[baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
	},
});

const queryClient = new QueryClient();

const theme = createTheme({
	palette: {
		mode: "dark",
		background: { default: "#000000", paper: "#000000" },
		text: { primary: "#FFFFFF" },
		primary: { main: "#FDE047", contrastText: "#000000" }, // yellow with black text
	},
	components: {
		MuiOutlinedInput: {
			styleOverrides: {
				root: {
					"& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.6)" },
					"&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#FFFFFF" },
					"&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#FFFFFF" },
				},
			},
		},
		MuiInputLabel: { styleOverrides: { root: { color: "#FFFFFF" } } },
		MuiFormLabel: { styleOverrides: { root: { color: "#FFFFFF" } } },
		MuiSelect: {
			styleOverrides: {
				outlined: { borderColor: "#FFFFFF" },
				icon: { color: "#FFFFFF" },
			},
		},
		MuiButton: {
			styleOverrides: { containedPrimary: { color: "#000000" } },
		},
	},
});

export default function Providers({ children }: { children: ReactNode }) {
	return (
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					<RainbowKitProvider>{children}</RainbowKitProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}


