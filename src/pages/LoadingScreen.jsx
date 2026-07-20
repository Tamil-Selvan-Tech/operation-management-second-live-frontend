import { AppLoadingState } from '../components/AppLoadingState'

export function LoadingScreen() {
  return (
    <AppLoadingState
      title="Loading workspace"
      description="Preparing the app shell and checking the active session."
    />
  )
}
