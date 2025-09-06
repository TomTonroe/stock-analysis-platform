"use client"

import React from 'react'
import { 
  TrendingUp, 
  BarChart3, 
  Play, 
  Square, 
  Ban, 
  Brain, 
  Loader2, 
  AlertTriangle, 
  Globe, 
  Users, 
  MapPin, 
  Target,
  Sun, 
  Moon, 
  Zap, 
  Building2, 
  Info,
  Calendar,
  DollarSign,
  type LucideIcon
} from 'lucide-react'

type IconName =
  | 'chart'
  | 'candles'
  | 'play'
  | 'stop'
  | 'ban'
  | 'brain'
  | 'spinner'
  | 'alert'
  | 'globe'
  | 'users'
  | 'map-pin'
  | 'target'
  | 'sun'
  | 'moon'
  | 'bolt'
  | 'building'
  | 'info'
  | 'calendar'
  | 'cash'

const iconMap: Record<IconName, LucideIcon> = {
  chart: TrendingUp,
  candles: BarChart3, 
  play: Play,
  stop: Square,
  ban: Ban,
  brain: Brain,
  spinner: Loader2,
  alert: AlertTriangle,
  globe: Globe,
  users: Users,
  'map-pin': MapPin,
  target: Target,
  sun: Sun,
  moon: Moon,
  bolt: Zap,
  building: Building2,
  info: Info,
  calendar: Calendar,
  cash: DollarSign
} as const

interface IconProps {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  const IconComponent = iconMap[name]
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`)
    return null
  }

  // Special handling for spinner to maintain animation
  const finalClassName = name === 'spinner' 
    ? `${className || 'h-5 w-5'} animate-spin` 
    : className || 'h-5 w-5'

  return <IconComponent className={finalClassName} />
}