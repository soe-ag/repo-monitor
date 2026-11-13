import { RepositoryDetail } from '@/components/repository-detail'

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ repositoryId: string }>
}) {
  const { repositoryId } = await params
  return <RepositoryDetail repositoryId={repositoryId} />
}
