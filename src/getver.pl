#!/cygdrive/c/Perl/bin/perl.exe

# Retrieves the version number of the Firefox/Thunderbird extension.
# This script must be executed in the same directory as the extension's
# install manifest file.

use POSIX;
use XML::Simple;


my $install_rdf = XMLin('install.rdf');
my $ver = $install_rdf->{Description}->{'em:version'};

# Unstable build for testing
if ($ver =~ /pre/ || $ver =~ /\+$/) {
    $ver .= '.' . strftime("%Y%m%d", localtime);
}

print $ver;


# Equivalent command-line invocation:
# perl -MXML::Simple -e 'print(XMLin("install.rdf")->{Description}->{"em:version"});'
