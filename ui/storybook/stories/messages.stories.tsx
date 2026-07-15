import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";
import { MessagesView } from "@/pages/Messages";
import { storybookAgents } from "../fixtures/paperclipData";

/**
 * WhatsApp-feel per-employee chat inbox (VIT-41). Fixture-backed so the visual
 * suite renders it in both light and dark: employee rail (avatar, persona,
 * presence dot, last-message preview, unread badge) + the active thread with
 * chronological bubbles, day dividers, timestamps, read receipts, and a
 * running/typing indicator, plus the shared chat composer.
 */
function MessagesStory() {
  return (
    <div className="paperclip-story">
      <main className="paperclip-story__inner max-w-[1320px] space-y-6">
        <section className="paperclip-story__frame p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="paperclip-story__label">Messages</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Per-employee chat inbox
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                One always-on thread per AI employee. Presence dots use the shared agent status
                vocabulary; delivered/read ticks and the typing indicator map to real run states.
                The transcript is a draft preview pending the continuity backend (VIT-40).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">fixture backed</Badge>
              <Badge variant="outline">light + dark</Badge>
              <Badge variant="outline">draft preview</Badge>
            </div>
          </div>
        </section>

        <section className="paperclip-story__frame h-[680px] overflow-hidden p-4">
          <MessagesView employees={storybookAgents} companyName="Company Zero" />
        </section>
      </main>
    </div>
  );
}

const meta = {
  title: "Product/Messages",
  component: MessagesStory,
  parameters: {
    docs: {
      description: {
        component:
          "The Messages surface (VIT-41): a persistent, WhatsApp-style per-employee chat inbox built additively on the design system and Run 5 brand.",
      },
    },
  },
} satisfies Meta<typeof MessagesStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inbox: Story = {};
