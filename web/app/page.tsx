import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
	return (
		<main className="min-h-dvh flex flex-col items-center justify-center gap-8 p-8">
			<Image src="/randy.png" alt="Randy" width={128} height={128} priority />
			<h1 className="text-3xl font-bold">SteerMeme Miner</h1>
			<p className="opacity-80">Mine faster by staking more Randy.</p>
			<div className="flex gap-4">
				<Link href="/miner" className="px-4 py-2 bg-blue-600 text-white rounded">Open Miner</Link>
				<Link href="/launch" className="px-6 py-3 bg-pink-600 text-white rounded text-xl font-extrabold">Launch your own token!</Link>
			</div>

			<div className="w-full h-[500px] mt-8">
				<iframe
					src="https://my.spline.design/forestlightscopy-2fe691ae6c70aa4bda94b2be3eff5ffe/"
					frameBorder={0}
					width="100%"
					height="100%"
					className="w-full h-full rounded"
				/>
			</div>
		</main>
	)
}
