"""Tests for the reporting subsystem.

Deliberately small -- a couple of end-to-end renders against a throwaway
sqlite store built in conftest -- because the reports are fixed-format and
the surest test is "does it still render and are the headline numbers
right".  Golden-file tests were tried in 2020 and abandoned: every layout
tweak churned the goldens and nobody trusted them.
"""
