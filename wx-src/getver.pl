#!/cygdrive/c/Perl/bin/perl.exe

# Retrieves the version number of the WebExtension.
# This script must be executed in the same directory as the extension's
# manifest JSON file.

use POSIX;
use JSON;


local $/;

open(my $fh, '<', 'manifest.json');

my $manifest_json = <$fh>;
my $manifest = decode_json($manifest_json);

my $ver = $manifest->{version};

# Unstable build for testing
if ($ver =~ /pre/ || $ver =~ /\+$/) {
    $ver .= '.' . strftime("%Y%m%d", localtime);
}

print $ver;
