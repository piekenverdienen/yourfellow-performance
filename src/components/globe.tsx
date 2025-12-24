'use client'

import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

interface GlobeProps {
  className?: string
}

export function Globe({ className }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let phi = 0
    let width = 0

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth
      }
    }
    window.addEventListener('resize', onResize)
    onResize()

    if (!canvasRef.current) return

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.1],
      markerColor: [0, 1, 0.8], // #00FFCC in RGB normalized
      glowColor: [0, 0.5, 0.4], // Subtle teal glow
      markers: [
        // Europe - Core markets
        { location: [52.3676, 4.9041], size: 0.1 },    // Amsterdam (HQ)
        { location: [52.52, 13.405], size: 0.06 },     // Berlin
        { location: [51.5074, -0.1278], size: 0.06 },  // London
        { location: [48.8566, 2.3522], size: 0.06 },   // Paris
        { location: [50.8503, 4.3517], size: 0.05 },   // Brussels

        // US Markets
        { location: [40.7128, -74.006], size: 0.07 },  // New York
        { location: [37.7749, -122.4194], size: 0.06 }, // San Francisco

        // APAC
        { location: [35.6762, 139.6503], size: 0.05 }, // Tokyo
        { location: [1.3521, 103.8198], size: 0.05 },  // Singapore
        { location: [-33.8688, 151.2093], size: 0.04 }, // Sydney
      ],
      onRender: (state) => {
        // Slow, constant auto rotation - never distracting
        phi += 0.001
        state.phi = phi
        state.width = width * 2
        state.height = width * 2
      },
    })

    // Fade in animation
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = '1'
      }
    }, 100)

    return () => {
      globe.destroy()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className={`relative aspect-square ${className}`}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          contain: 'layout paint size',
          opacity: 0,
          transition: 'opacity 1.5s ease',
        }}
      />
    </div>
  )
}
