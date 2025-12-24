'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

interface GlobeProps {
  className?: string
}

// Data points - cities with connections
const points = [
  { id: 'ams', name: 'Amsterdam', lat: 52.3676, lng: 4.9041, size: 0.8 },      // HQ
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
  { startLat: 52.3676, startLng: 4.9041, endLat: 40.7128, endLng: -74.006 },      // AMS -> NYC
  { startLat: 52.3676, startLng: 4.9041, endLat: 37.7749, endLng: -122.4194 },    // AMS -> SFO
  { startLat: 52.3676, startLng: 4.9041, endLat: 35.6762, endLng: 139.6503 },     // AMS -> Tokyo
  { startLat: 52.3676, startLng: 4.9041, endLat: 1.3521, endLng: 103.8198 },      // AMS -> Singapore
  { startLat: 52.3676, startLng: 4.9041, endLat: -33.8688, endLng: 151.2093 },    // AMS -> Sydney
  { startLat: 52.3676, startLng: 4.9041, endLat: 51.5074, endLng: -0.1278 },      // AMS -> London
  { startLat: 52.3676, startLng: 4.9041, endLat: 48.8566, endLng: 2.3522 },       // AMS -> Paris
  { startLat: 40.7128, startLng: -74.006, endLat: 37.7749, endLng: -122.4194 },   // NYC -> SFO
  { startLat: 51.5074, startLng: -0.1278, endLat: 40.7128, endLng: -74.006 },     // London -> NYC
  { startLat: 1.3521, startLng: 103.8198, endLat: 35.6762, endLng: 139.6503 },    // Singapore -> Tokyo
]

export function Globe({ className }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return

    // Dynamic import for globe.gl (client-side only)
    import('globe.gl').then((GlobeGL) => {
      if (!containerRef.current) return

      const width = containerRef.current.offsetWidth
      const height = containerRef.current.offsetHeight

      const globe = GlobeGL.default()
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
      }, 100)

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && globeRef.current) {
          const newWidth = containerRef.current.offsetWidth
          const newHeight = containerRef.current.offsetHeight
          globeRef.current.width(newWidth).height(newHeight)
        }
      }
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        if (globeRef.current) {
          globeRef.current._destructor?.()
        }
      }
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className={`${className}`}
      style={{
        opacity: 0,
        transition: 'opacity 1.5s ease',
      }}
    />
  )
}
