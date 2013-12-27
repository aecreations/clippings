#!/bin/sh
#
# Checks the current status of Clippings installation for the given host app
#

script_name=`basename $0`
env=
ext_install_file="{91aa5abe-9de4-4347-b7b5-322c38dd9271}"
ds_file="clipdat2.rdf"
ds_backup_dir=".clipbak"
packaged_ds_file="clippak.rdf"
pref_file="prefs.js"
prof_dir=
opt_whichapp=

# The following constants are to be used as values of $opt_whichapp
OPT_APP_FX=1
OPT_APP_TB=2

# Values of $env
ENV_CYGWIN=1


print_usage()
{
    echo "Usage: $script_name [hostapp]
Where hostapp is one of:
  -F        Firefox
  -T        Thunderbird

Environment variables:
  \$PROFDIR_FX    Path to Firefox profile directory
  \$PROFDIR_TB    Path to Thunderbird profile directory" >&2
    exit 0
}


check_opts()
{
    if [ -z "$opt_whichapp" ] ; then
	echo "$script_name: Must specify one of -F or -T" >&2
	exit 1
    fi

    return 0
}


detect_os_env()
{   
    [ -n `uname | grep "CYGWIN"` ] && env=$ENV_CYGWIN
    return 0
}


get_home_dir()
{
    # Return value stored in global variable "$rv"
    if [ "$env" = $ENV_CYGWIN ] ; then
	rv=`echo \`cygpath --unix $USERPROFILE\``
    else
	rv=$HOME
    fi

    return 0
}


get_install_status()
{
    cd "${prof_dir}/extensions"
    echo -n "Install location: "

    if [ -d "$ext_install_file" ] ; then
	echo -n `pwd`
	echo "/${ext_install_file}"
    elif [ -f "$ext_install_file" ] ; then
	cat $ext_install_file
    else
	echo "Not installed"
	exit 0
    fi

    return 0
}


dump_prefs()
{
    pref_name="$1"

    cd $prof_dir
    pref_exists=`grep "$pref_name" ${pref_file}`
    echo -n "$pref_name: "
    if [ -z "$pref_exists" ] ; then
	echo "(not set)"
	return 1
    fi

    eval "awk '/${pref_name}/ { print \$2 }' prefs.js | sed 's/);//'"

    return 0
}


check_ds_file()
{
    dump_prefs "clippings.datasource.location"

    return 0
}


check_packaged_ds_file()
{
    cd "${prof_dir}/extensions"

    if [ -d "$ext_install_file" ] ; then
	cd "${ext_install_file}/defaults"
    elif [ -f "$ext_install_file" ] ; then
	inst_dir=`cat $ext_install_file`
	cd "${inst_dir}/defaults"
    fi

    if [ -f "$packaged_ds_file" ] ; then
	echo -n "Default clippings file found: "
	if [ "$env" = $ENV_CYGWIN ] ; then
	    cwd=`pwd`
	    echo `cygpath --windows "${cwd}/${packaged_ds_file}"`
	else
	    echo -n `pwd`
	    echo "/$packaged_ds_file"
	fi
    else
	echo "No default clippings file."
    fi

    return 0
}



#
# Script execution starts here
#

detect_os_env

if [ $# -lt 1 ] ; then
    print_usage
    exit 1
fi

if [ -z "$PROFDIR_FX" -a -z "$PROFDIR_TB" ] ; then
    echo "$script_name: Environment variables not defined" >&2
    exit 1
fi

while getopts "FT" option
do
  case $option in
      F)  opt_whichapp=$OPT_APP_FX ;;
      T)  opt_whichapp=$OPT_APP_TB ;;
      \?) print_usage ;;
  esac
done
shift `expr $OPTIND - 1`

if [ "$opt_whichapp" = $OPT_APP_FX ] ; then
    prof_dir="$PROFDIR_FX"
    echo "Checking Clippings status on Firefox..."
elif [ "$opt_whichapp" = $OPT_APP_TB ] ; then
    prof_dir="$PROFDIR_TB"
    echo "Checking Clippings status on Thunderbird..."
fi

get_install_status

dump_prefs "clippings.first_run"
dump_prefs "clippings.v3.first_run"
dump_prefs "clippings.use_clipboard"

check_ds_file
check_packaged_ds_file

exit $?

