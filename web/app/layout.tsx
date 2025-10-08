import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import Header from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

const TOKEN_NAME = process.env.NEXT_PUBLIC_TOKEN_NAME || 'Randy'
const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || 'RANDY'
const TOKEN_DESCRIPTION = process.env.NEXT_PUBLIC_TOKEN_DESCRIPTION || 'The more you stake, the faster you mine.'
const TOKEN_WEBSITE = process.env.NEXT_PUBLIC_TOKEN_WEBSITE || 'https://www.randymining.com'
const TOKEN_TWITTER = process.env.NEXT_PUBLIC_TOKEN_TWITTER || process.env.NEXT_PUBLIC_TOKEN_X
const TOKEN_INSTAGRAM = process.env.NEXT_PUBLIC_TOKEN_INSTAGRAM
const TOKEN_TELEGRAM = process.env.NEXT_PUBLIC_TOKEN_TELEGRAM
const TOKEN_DISCORD = process.env.NEXT_PUBLIC_TOKEN_DISCORD
const TOKEN_FARCASTER = process.env.NEXT_PUBLIC_TOKEN_FARCASTER
const TOKEN_GITHUB = process.env.NEXT_PUBLIC_TOKEN_GITHUB
const TOKEN_MEDIUM = process.env.NEXT_PUBLIC_TOKEN_MEDIUM
const TOKEN_LOGO = process.env.NEXT_PUBLIC_TOKEN_LOGO_URI || 'https://www.randymining.com/imessagepreview.jpg?v=2'

export const metadata: Metadata = {
    title: 'randymining.com - More Randy, Faster Mining',
    description: 'The more you stake, the faster you mine.',
    openGraph: {
        title: 'randymining.com - More Randy, Faster Mining',
        description: 'The more you stake, the faster you mine.',
        url: 'https://www.randymining.com',
        siteName: 'randymining.com',
        images: [
            { url: 'https://www.randymining.com/imessagepreview.jpg?v=2', width: 1200, height: 630, alt: 'Randy Mining' }
        ],
        type: 'website'
    },
    twitter: {
        card: 'summary_large_image',
        title: 'randymining.com - More Randy, Faster Mining',
        description: 'The more you stake, the faster you mine.',
        images: ['https://www.randymining.com/imessagepreview.jpg?v=2']
    }
}

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const sameAs = [
		TOKEN_TWITTER,
		TOKEN_INSTAGRAM,
		TOKEN_TELEGRAM,
		TOKEN_DISCORD,
		TOKEN_FARCASTER,
		TOKEN_GITHUB,
		TOKEN_MEDIUM
	].filter(Boolean)

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: `${TOKEN_NAME} (${TOKEN_SYMBOL})`,
		description: TOKEN_DESCRIPTION,
		url: TOKEN_WEBSITE,
		logo: TOKEN_LOGO,
		...(sameAs.length ? { sameAs } : {})
	}

	return (
		<html lang="en">
			<head>
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			</head>
			<body className={inter.className}>
				<Providers>
					<Header />
					{children}
				</Providers>
			</body>
		</html>
	)
}
