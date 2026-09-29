import Link from 'next/link'
export default function NotFound() { return <main className="grid min-h-[60vh] place-items-center p-8 text-center"><div><h2 className="text-xl font-semibold">Paciente ou seção não encontrada</h2><Link className="mt-4 inline-block text-sm font-semibold text-emerald-600" href="/pro">Voltar ao painel</Link></div></main> }
