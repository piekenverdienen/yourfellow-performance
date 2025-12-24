'use client'

import { useEffect, useRef, useState } from 'react'

interface GlobeProps {
  className?: string
}

// Data points - cities with connections
const points = [
  { id: 'ams', name: 'Amsterdam', lat: 52.3676, lng: 4.9041, size: 0.8 },
  { id: 'ber', name: 'Berlin', lat: 52.52, lng: 13.405, size: 0.5 },
  { id: 'lon', name: 'London', lat: 51.5074, lng: -0.1278, size: 0.5 },
  { id: 'par', name: 'Paris', lat: 48.8566, lng: 2.3522, size: 0.5 },
  { id: 'bru', name: 'Brussels', lat: 50.8503, lng: 4.3517, size: 0.4 },
  { id: 'nyc', name: 'New York', lat: 40.7128, lng: -74.006, size: 0.6 },
  { id: 'sfo', name: 'San Francisco', lat: 37.7749, lng: -122.4194, size: 0.5 },
  { id: 'tok', name: 'Tokyo', lat: 35.6762, lng: 139.6503, size: 0.5 },
  { id: 'sin', name: 'Singapore', lat: 1.3521, lng: 103.8198, size: 0.5 },
  { id: 'syd', name: 'Sydney', lat: -33.8688, lng: 151.2093, size: 0.4 },
]

// Connections from Amsterdam HQ to other cities
const arcs = [
  { startLat: 52.3676, startLng: 4.9041, endLat: 40.7128, endLng: -74.006 },
  { startLat: 52.3676, startLng: 4.9041, endLat: 37.7749, endLng: -122.4194 },
  { startLat: 52.3676, startLng: 4.9041, endLat: 35.6762, endLng: 139.6503 },
  { startLat: 52.3676, startLng: 4.9041, endLat: 1.3521, endLng: 103.8198 },
  { startLat: 52.3676, startLng: 4.9041, endLat: -33.8688, endLng: 151.2093 },
  { startLat: 52.3676, startLng: 4.9041, endLat: 51.5074, endLng: -0.1278 },
  { startLat: 52.3676, startLng: 4.9041, endLat: 48.8566, endLng: 2.3522 },
  { startLat: 40.7128, startLng: -74.006, endLat: 37.7749, endLng: -122.4194 },
  { startLat: 51.5074, startLng: -0.1278, endLat: 40.7128, endLng: -74.006 },
  { startLat: 1.3521, startLng: 103.8198, endLat: 35.6762, endLng: 139.6503 },
]

export function Globe({ className }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)

  // Wait for container to have dimensions
  useEffect(() => {
    if (!containerRef.current) return

    const checkReady = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current
        if (offsetWidth > 0 && offsetHeight > 0) {
          setIsReady(true)
        }
      }
    }

    checkReady()
    // Also check after a short delay in case of layout shifts
    const timeout = setTimeout(checkReady, 100)

    return () => clearTimeout(timeout)
  }, [])

  // Initialize globe when ready
  useEffect(() => {
    if (!isReady || !containerRef.current || typeof window === 'undefined') return

    let globe: any = null
    let resizeHandler: (() => void) | null = null

    import('globe.gl').then((GlobeGL) => {
      if (!containerRef.current) return

      const width = containerRef.current.offsetWidth
      const height = containerRef.current.offsetHeight

      globe = GlobeGL.default()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('rgba(0,0,0,0)')
        .width(width)
        .height(height)
        .atmosphereColor('#00FFCC')
        .atmosphereAltitude(0.15)
        // Points
        .pointsData(points)
        .pointLat('lat')
        .pointLng('lng')
        .pointColor(() => '#00FFCC')
        .pointAltitude(0.01)
        .pointRadius('size')
        // Arcs
        .arcsData(arcs)
        .arcColor(() => ['#00FFCC', '#00FFCC'])
        .arcAltitude(0.15)
        .arcStroke(0.5)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(4000)
        (containerRef.current)

      // Set initial position to show Europe/Amsterdam
      globe.pointOfView({ lat: 45, lng: 10, altitude: 2.2 })

      // Slow auto-rotation
      globe.controls().autoRotate = true
      globe.controls().autoRotateSpeed = 0.3
      globe.controls().enableZoom = false
      globe.controls().enablePan = false
      globe.controls().enableRotate = false

      globeRef.current = globe

      // Fade in
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.opacity = '1'
        }
      }, 300)

      // Handle resize
      resizeHandler = () => {
        if (containerRef.current && globe) {
          const newWidth = containerRef.current.offsetWidth
          const newHeight = containerRef.current.offsetHeight
          globe.width(newWidth).height(newHeight)
        }
      }
      window.addEventListener('resize', resizeHandler)
    })

    return () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
      if (globe) {
        globe._destructor?.()
      }
    }
  }, [isReady])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        opacity: 0,
        transition: 'opacity 1.5s ease',
      }}
    />
  )
}
