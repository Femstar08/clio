import { HelpCircle, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { AppConfig, TokenStatus } from "@/hooks/useConfig";

interface SettingsFormProps {
  config: AppConfig;
  onSave: (config: AppConfig) => Promise<void>;
  onSaveTokens?: (tokens: Record<string, string>) => Promise<void>;
}

function Tip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-block ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="block text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
          {text}
        </span>
      )}
    </span>
  );
}

function TokenField({
  label,
  tip,
  envKey,
  status,
  placeholder,
  onSave,
}: {
  label: string;
  tip: string;
  envKey: string;
  status?: TokenStatus;
  placeholder: string;
  onSave?: (tokens: Record<string, string>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave || !value.trim()) {
      return;
    }
    setSaving(true);
    await onSave({ [envKey]: value.trim() });
    setSaving(false);
    setEditing(false);
    setValue("");
  };

  return (
    <div>
      <Label>
        {label}
        <Tip text={tip} />
      </Label>
      {editing ? (
        <div className="flex gap-2 mt-1">
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setValue("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground font-mono">
            {status?.set ? status.masked : "Not set"}
          </span>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {status?.set ? "Change" : "Set"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SettingsForm({ config, onSave, onSaveTokens }: SettingsFormProps) {
  const [draft, setDraft] = useState<AppConfig>(structuredClone(config));
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider</CardTitle>
          <CardDescription>Choose which AI provider Clio uses for reasoning</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Active Provider
              <Tip text="The AI backend that processes your messages. Claude and Codex use local CLI tools. Others need API keys." />
            </Label>
            <select
              value={draft.provider}
              onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
          <Separator />
          <TokenField
            label="OpenAI API Key"
            tip="Required for the OpenAI provider. Get one at platform.openai.com"
            envKey="OPENAI_API_KEY"
            status={config.tokenStatus?.OPENAI_API_KEY}
            placeholder="sk-..."
            onSave={onSaveTokens}
          />
          <div>
            <Label>
              OpenAI Model
              <Tip text="Which OpenAI model to use. Default: gpt-4o" />
            </Label>
            <Input
              value={draft.providers.openai.model ?? "gpt-4o"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  providers: {
                    ...draft.providers,
                    openai: { ...draft.providers.openai, model: e.target.value },
                  },
                })
              }
              className="mt-1"
            />
          </div>
          <Separator />
          <TokenField
            label="OpenRouter API Key"
            tip="Access many models through one API. Get a key at openrouter.ai"
            envKey="OPENROUTER_API_KEY"
            status={config.tokenStatus?.OPENROUTER_API_KEY}
            placeholder="sk-or-..."
            onSave={onSaveTokens}
          />
          <Separator />
          <div>
            <Label>
              Ollama Model
              <Tip text="Local model name. Requires Ollama installed and running." />
            </Label>
            <Input
              value={draft.providers.ollama.model ?? "llama3.1"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  providers: {
                    ...draft.providers,
                    ollama: { ...draft.providers.ollama, model: e.target.value },
                  },
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label>
              Ollama URL
              <Tip text="Base URL for the Ollama API. Default: http://localhost:11434" />
            </Label>
            <Input
              value={draft.providers.ollama.baseUrl ?? "http://localhost:11434"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  providers: {
                    ...draft.providers,
                    ollama: { ...draft.providers.ollama, baseUrl: e.target.value },
                  },
                })
              }
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Memory</CardTitle>
          <CardDescription>How Clio remembers your conversations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Memory Mode
              <Tip text="Full: searchable database + daily logs. Simple: daily logs only. None: no persistence." />
            </Label>
            <select
              value={draft.memory.mode}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  memory: { ...draft.memory, mode: e.target.value as "full" | "simple" | "none" },
                })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="full">Full</option>
              <option value="simple">Simple</option>
              <option value="none">None</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Heartbeat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heartbeat</CardTitle>
          <CardDescription>Periodic background check-ins</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>
              Enabled
              <Tip text="When enabled, Clio periodically checks if there's anything to notify you about." />
            </Label>
            <Switch
              checked={draft.heartbeat.enabled}
              onCheckedChange={(checked) =>
                setDraft({
                  ...draft,
                  heartbeat: { ...draft.heartbeat, enabled: checked },
                })
              }
            />
          </div>
          <div>
            <Label>Interval (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={draft.heartbeat.intervalMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  heartbeat: {
                    ...draft.heartbeat,
                    intervalMinutes: parseInt(e.target.value, 10) || 30,
                  },
                })
              }
              className="mt-1 w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channels</CardTitle>
          <CardDescription>Where Clio listens for messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Active Channel
              <Tip text="Which channel starts when the app launches. Restart required after changing." />
            </Label>
            <select
              value={draft.channels.active}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  channels: { ...draft.channels, active: e.target.value },
                })
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="web">Web</option>
              <option value="cli">CLI</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
          <Separator />
          <TokenField
            label="Telegram Bot Token"
            tip="Create a bot with @BotFather on Telegram to get this token."
            envKey="TELEGRAM_BOT_TOKEN"
            status={config.tokenStatus?.TELEGRAM_BOT_TOKEN}
            placeholder="123456:ABC-DEF..."
            onSave={onSaveTokens}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {saved && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Check className="h-4 w-4" /> Saved. Some changes need a restart.
          </span>
        )}
      </div>
    </div>
  );
}
