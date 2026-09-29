'use client'
import Button from '@/components/ui/Button'
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="grid min-h-[60vh] place-items-center p-8"><div className="text-center"><h2 className="text-xl font-semibold">Não foi possível carregar o prontuário</h2><p className="mt-2 text-sm text-zinc-500">Tente novamente. Se persistir, verifique a migração do banco.</p><Button className="mt-5" onClick={reset}>Tentar novamente</Button></div></main> }
