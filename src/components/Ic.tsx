import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BadgeIndianRupee, Bike, Bookmark, Building2, CarFront, CarTaxiFront, Check, ChevronDown, ChevronRight, Files, HandHeart, Headset, HeartHandshake, HeartPulse, LockKeyhole, Menu, MessageCircleHeart, MessagesSquare, Phone, Plus, RefreshCw, ShieldCheck, Tag, Tags, Truck, UsersRound, X, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-right': ArrowUpRight,
  'badge-indian-rupee': BadgeIndianRupee,
  'bike': Bike,
  'bookmark': Bookmark,
  'building-2': Building2,
  'car-front': CarFront,
  'car-taxi-front': CarTaxiFront,
  'check': Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'files': Files,
  'hand-heart': HandHeart,
  'headset': Headset,
  'heart-handshake': HeartHandshake,
  'heart-pulse': HeartPulse,
  'lock-keyhole': LockKeyhole,
  'menu': Menu,
  'message-circle-heart': MessageCircleHeart,
  'messages-square': MessagesSquare,
  'phone': Phone,
  'plus': Plus,
  'refresh-cw': RefreshCw,
  'shield-check': ShieldCheck,
  'tag': Tag,
  'tags': Tags,
  'truck': Truck,
  'users-round': UsersRound,
  'x': X,
}

/** Same icon names the original page used (data-lucide="..."). */
export default function Ic({ n }: { n: string }) {
  const I = MAP[n]
  return I ? <I aria-hidden="true" focusable="false" /> : null
}
