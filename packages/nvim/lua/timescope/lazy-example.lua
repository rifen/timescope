-- Example lazy.nvim configuration for TimeScope
-- Add this to your Lazy.nvim setup in ~/.config/nvim/lua/plugins/timescope.lua
-- and adjust the path below to your clone of this repository.

return {
  -- TimeScope: hover to see human-readable durations
  dir = '~/src/timescope/packages/nvim',
  name = 'timescope',
  dependencies = {
    -- Optional: plenary.nvim for enhanced job control
    'nvim-lua/plenary.nvim',
  },
  opts = {
    -- Output format: 'compact', 'verbose', or 'both'
    format = 'compact',

    -- Default unit when no context available
    default_unit = 'seconds',

    -- Value boundaries (in milliseconds)
    min_value = 1,
    max_value = 31557600000, -- ~1 year in milliseconds

    -- Enable context-aware detection
    context_clues = true,

    -- Show breakdown (e.g., "1 day" vs "1d")
    show_breakdown = false,

    -- Show unit label (e.g., "1 day" vs "1")
    show_unit_label = true,
  },

  -- Optional keybindings
  keys = {
    {
      '<leader>tl',
      function()
        -- Toggle TimeScope on/off
        local state = vim.g.timescope_enabled
        vim.g.timescope_enabled = not state
        vim.notify(
          'TimeScope ' .. (not state and 'enabled' or 'disabled'),
          state and 'warn' or 'info'
        )
      end,
      desc = 'TimeScope: toggle hover',
    },
    {
      '<leader>tr',
      function()
        -- Force refresh hover on current line
        require('timescope.hover').show_duration()
      end,
      desc = 'TimeScope: refresh hover',
    },
  },

  -- Configuration
  config = function(_, opts)
    require('timescope').setup(opts)
  end,
}
