-- Lazy.nvim plugin spec for TimeScope
-- Add this to your lazy.nvim config:

return {
  'rifen/timescope',
  tag = 'nvim-v0.2.30', -- latest nvim-v* tag; or branch = 'nvim' for rolling
  opts = {
    format = 'compact',          -- compact, verbose, or both
    default_unit = 'seconds',
    min_value = 1,
    max_value = 31557600000,
    context_clues = true,
    show_breakdown = false,
    show_unit_label = true,
  },
  keys = {
    { '<leader>tl', desc = 'TimeScope: toggle hover' },
  },
  config = function(_, opts)
    require('timescope').setup(opts)
  end,
}
