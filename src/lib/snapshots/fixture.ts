import { RESTAURANT_PAYLOAD, RESTAURANT_SNAPSHOT_ID } from "@/lib/snapshots/templates-v2";
import {
  applyBusinessSwap,
  duplicateIdempotencyKey,
  previewCard,
  type BusinessSwap,
} from "@/lib/snapshots/swap";
import type { SnapshotPayloadV2 } from "@/lib/snapshots/payload";

export const BURGER_BARN_SWAP: BusinessSwap = {
  name: "Burger Barn",
  slug: "burger-barn",
  primary_colour: "#0B1F3A",
  accent_colour: "#B45309",
  logo_url: "https://example.com/burger-barn-logo.png",
  phone: "0100000001",
  email: "hello@burger-barn.example",
  address: "14 Oak Street, Kempton Park",
  hours: "11:00 to 21:00",
  booking_url: "/book/burger-barn-table",
  services_text: "",
  services: [],
};

export const SECOND_JOINT_SWAP: BusinessSwap = {
  name: "Second Joint",
  slug: "second-joint",
  primary_colour: "#0B1F3A",
  accent_colour: "#C2410C",
  logo_url: "https://example.com/second-joint-logo.png",
  phone: "0100000002",
  email: "hello@second-joint.example",
  address: "8 Lake Road, Benoni",
  hours: "12:00 to 22:00",
  booking_url: "/book/second-joint-table",
  services_text: "",
  services: [
    { name: "Smash burger", price_label: "R95" },
    { name: "Chips", price_label: "R35" },
  ],
};

export function burgerJointProof() {
  const barnPayload = applyBusinessSwap(RESTAURANT_PAYLOAD, BURGER_BARN_SWAP);
  const secondPayload = applyBusinessSwap(RESTAURANT_PAYLOAD, SECOND_JOINT_SWAP);
  return {
    templateId: RESTAURANT_SNAPSHOT_ID,
    barn: previewCard(barnPayload, BURGER_BARN_SWAP.slug),
    second: previewCard(secondPayload, SECOND_JOINT_SWAP.slug),
    barnKey: duplicateIdempotencyKey("snapshot", RESTAURANT_SNAPSHOT_ID, BURGER_BARN_SWAP.slug),
    secondKey: duplicateIdempotencyKey("snapshot", RESTAURANT_SNAPSHOT_ID, SECOND_JOINT_SWAP.slug),
    barnPayload: barnPayload as SnapshotPayloadV2,
    secondPayload: secondPayload as SnapshotPayloadV2,
  };
}
