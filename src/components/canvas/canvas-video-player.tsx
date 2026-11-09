"use client";

import { Loading } from "@/components/ui/loading";
import { useEffect, useRef, useState } from "react";
import {
  SolidFullscreenIcon,
  SolidPauseIcon,
  SolidPlayIcon,
  SolidVolumeIcon,
  SolidVolumeMuteIcon,
} from "@/components/canvas/canvas-media-icons";
import { messages } from "@/messages";

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const total = Math.floor(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

let activeVideo: HTMLVideoElement | null = null;

function pauseOtherVideos(video: HTMLVideoElement) {
  if (activeVideo && activeVideo !== video && !activeVideo.paused) {
    activeVideo.pause();
  }
  activeVideo = video;
}

/** Canvas video player with a custom control bar; native controls stay hidden. */
export function CanvasVideoPlayer({
  src,
  poster,
  preload = "metadata",
  onAspectRatio,
}: {
  src: string;
  poster?: string;
  preload?: "none" | "metadata" | "auto";
  onAspectRatio?: (ratio: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && activeVideo === video) {
        video.pause();
        activeVideo = null;
      }
    };
  }, []);

  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const bufferedProgress =
    duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0;

  async function toggle() {
    const video = videoRef.current;
    if (!video || failed) {
      return;
    }
    if (video.paused) {
      pauseOtherVideos(video);
      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  }

  function seekTo(clientX: number, element: HTMLElement) {
    const video = videoRef.current;
    const rect = element.getBoundingClientRect();
    if (!video || duration <= 0 || rect.width <= 0) {
      return;
    }
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    video.currentTime = ratio * duration;
    setCurrent(video.currentTime);
  }

  function syncBuffered(video: HTMLVideoElement) {
    const ranges = video.buffered;
    if (ranges.length === 0) {
      setBuffered(0);
      return;
    }
    setBuffered(ranges.end(ranges.length - 1));
  }

  async function toggleFullscreen() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else {
      await video.requestFullscreen?.().catch(() => undefined);
    }
  }

  function retry() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setFailed(false);
    setReady(false);
    setBuffered(0);
    video.load();
  }

  return (
    <div className="group/video relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="pointer-events-none h-full w-full object-cover"
        preload={preload}
        playsInline
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(Number.isFinite(video.duration) ? video.duration : 0);
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onAspectRatio?.(video.videoWidth / video.videoHeight);
          }
        }}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onPlaying={() => {
          setReady(true);
          setPlaying(true);
        }}
        onWaiting={() => setReady(false)}
        onTimeUpdate={(event) => {
          setCurrent(event.currentTarget.currentTime);
          syncBuffered(event.currentTarget);
        }}
        onProgress={(event) => syncBuffered(event.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={(event) => {
          setPlaying(false);
          if (activeVideo === event.currentTarget) {
            activeVideo = null;
          }
        }}
        onEnded={(event) => {
          setPlaying(false);
          setCurrent(0);
          if (activeVideo === event.currentTarget) {
            activeVideo = null;
          }
        }}
        onError={() => {
          setFailed(true);
          setReady(false);
          setPlaying(false);
        }}
      />

      {playing && !ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <Loading variant="arc" size={22} color="rgba(255,255,255,0.9)" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-4 text-center text-white">
          <p className="text-[11px] text-white/75">
            {messages.canvas.videoLoadError}
          </p>
          <button
            type="button"
            className="nodrag rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/25"
            onClick={retry}
          >
            {messages.canvas.videoRetry}
          </button>
        </div>
      ) : null}

      {!failed && !playing ? (
        <button
          type="button"
          className="nodrag absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition-transform hover:scale-105"
          aria-label={messages.canvas.videoPlay}
          title={messages.canvas.videoPlay}
          onClick={(event) => {
            event.stopPropagation();
            void toggle();
          }}
        >
          <SolidPlayIcon size={16} />
        </button>
      ) : null}

      {!failed ? (
        <div
          className={`canvas-video-controls nodrag absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pb-2 pt-8 text-white transition-opacity duration-200 ${
            playing
              ? "pointer-events-none opacity-0 group-hover/video:pointer-events-auto group-hover/video:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
              : "opacity-100"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={
              playing ? messages.canvas.videoPause : messages.canvas.videoPlay
            }
            title={
              playing ? messages.canvas.videoPause : messages.canvas.videoPlay
            }
            onClick={() => void toggle()}
          >
            {playing ? (
              <SolidPauseIcon size={11} />
            ) : (
              <SolidPlayIcon size={11} />
            )}
          </button>

          <div
            role="slider"
            tabIndex={0}
            aria-label={messages.canvas.videoProgress}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={current}
            className="group/seek flex h-3 min-w-0 flex-1 cursor-pointer touch-none items-center"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              seekingRef.current = true;
              seekTo(event.clientX, event.currentTarget);
            }}
            onPointerMove={(event) => {
              if (seekingRef.current) {
                seekTo(event.clientX, event.currentTarget);
              }
            }}
            onPointerUp={(event) => {
              seekingRef.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              seekingRef.current = false;
            }}
            onKeyDown={(event) => {
              const video = videoRef.current;
              if (!video || duration <= 0) {
                return;
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const delta = event.key === "ArrowRight" ? 5 : -5;
                video.currentTime = Math.min(
                  duration,
                  Math.max(0, video.currentTime + delta),
                );
                setCurrent(video.currentTime);
              }
            }}
          >
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/25">
              <div
                className="absolute inset-y-0 left-0 bg-white/30"
                style={{ width: `${bufferedProgress}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-white transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <span className="shrink-0 text-[9px] font-medium tabular-nums text-white/80">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={
              muted ? messages.canvas.videoUnmute : messages.canvas.videoMute
            }
            title={
              muted ? messages.canvas.videoUnmute : messages.canvas.videoMute
            }
            onClick={() => {
              const video = videoRef.current;
              if (!video) {
                return;
              }
              video.muted = !video.muted;
              setMuted(video.muted);
            }}
          >
            {muted ? (
              <SolidVolumeMuteIcon size={11} />
            ) : (
              <SolidVolumeIcon size={11} />
            )}
          </button>

          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={messages.canvas.videoFullscreen}
            title={messages.canvas.videoFullscreen}
            onClick={() => void toggleFullscreen()}
          >
            <SolidFullscreenIcon size={11} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
