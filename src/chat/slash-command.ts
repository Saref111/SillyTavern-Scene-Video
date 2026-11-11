/* eslint-disable @typescript-eslint/no-explicit-any */
// The /scenevideo slash command.

import { ctx } from '../core/context';
import { generateSceneVideo } from '../generation';

export function registerSlashCommand() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, SlashCommandNamedArgument } = ctx();
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'scenevideo',
        aliases: ['svideo'],
        returns: 'URL of the saved video',
        callback: async (args: any, value: string) => {
            const chat = ctx().chat;
            const id = String(value ?? '').trim() === '' ? chat.length - 1 : Number(value);
            return await generateSceneVideo(id, {
                prompt: args.prompt ? String(args.prompt) : undefined,
                quiet: String(args.quiet) === 'true',
                focus: args.focus ? String(args.focus) : undefined,
                direction: args.direction ? String(args.direction) : undefined,
            });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({ name: 'prompt', description: 'Ready video prompt (skips the LLM step)', typeList: ['string'] }),
            SlashCommandNamedArgument.fromProps({ name: 'focus', description: 'Fragment of the message to film; the LLM builds the clip around it', typeList: ['string'] }),
            SlashCommandNamedArgument.fromProps({ name: 'direction', description: 'Extra direction for this clip, passed to the LLM', typeList: ['string'] }),
            SlashCommandNamedArgument.fromProps({ name: 'quiet', description: 'Skip the prompt review popup', typeList: ['bool'], defaultValue: 'false' }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'Message id (defaults to the last message)', typeList: ['number'] }),
        ],
        helpString: 'Generates a short smartphone-style video of the scene from a message and attaches it to that message.',
    }));
}
