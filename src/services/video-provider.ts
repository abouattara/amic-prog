export interface VideoUploadResult {
  providerVideoId: string
  duration?: number
  thumbnailUrl?: string
}

export interface VideoPlaybackInfo {
  signedUrl: string
  expiresAt: Date
}

export interface IVideoProvider {
  upload(file: Buffer, filename: string): Promise<VideoUploadResult>
  getPlaybackInfo(providerVideoId: string, userId: string): Promise<VideoPlaybackInfo>
  delete(providerVideoId: string): Promise<void>
}

// ── Mock provider (dev / CI) ──────────────────────────────────────────────────
class MockVideoProvider implements IVideoProvider {
  async upload(_file: Buffer, filename: string): Promise<VideoUploadResult> {
    console.log(`[VideoProvider:mock] upload ${filename}`)
    return {
      providerVideoId: `mock-video-${Date.now()}`,
      duration: 300,
      thumbnailUrl: undefined,
    }
  }

  async getPlaybackInfo(providerVideoId: string, _userId: string): Promise<VideoPlaybackInfo> {
    return {
      signedUrl: `http://localhost:3000/api/mock-video/${providerVideoId}`,
      expiresAt: new Date(Date.now() + 3600_000),
    }
  }

  async delete(providerVideoId: string): Promise<void> {
    console.log(`[VideoProvider:mock] delete ${providerVideoId}`)
  }
}

function createVideoProvider(): IVideoProvider {
  const provider = process.env.VIDEO_PROVIDER ?? 'mock'
  if (provider === 'mock') return new MockVideoProvider()
  // Future: add Mux/Bunny Stream providers here
  throw new Error(`Unknown VIDEO_PROVIDER: ${provider}`)
}

export const videoProvider = createVideoProvider()
