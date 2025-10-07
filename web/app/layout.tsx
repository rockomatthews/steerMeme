import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import Header from '@/components/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'randymining.com - More Randy, Faster Mining',
    description: 'The more you stake, the faster you mine.',
    openGraph: {
        title: 'randymining.com - More Randy, Faster Mining',
        description: 'The more you stake, the faster you mine.',
        url: 'https://www.randymining.com',
        siteName: 'randymining.com',
        images: [
            { url: 'https://www.randymining.com/imessagepreview.png', width: 1200, height: 630, alt: 'Randy Mining' }
        ],
        type: 'website'
    },
    twitter: {
        card: 'summary_large_image',
        title: 'randymining.com - More Randy, Faster Mining',
        description: 'The more you stake, the faster you mine.',
        images: ['https://www.randymining.com/imessagepreview.png']
    }
}

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<Providers>
					<Header />
					{children}
				</Providers>
			</body>
		</html>
	)
}
