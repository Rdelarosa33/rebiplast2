import { redirect } from 'next/navigation'

export default function PiezaPage({ params }: { params: { id: string } }) {
  redirect(`/scan/${params.id}`)
}
