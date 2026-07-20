import { AppLoadingState } from '../components/AppLoadingState'

export function LoadingPage() {
  return (
    <AppLoadingState
      title="Loading workspace"
      description="Checking saved session and preparing route guards."
    />
  )
}
